// ─────────────────────────────────────────────────────────────────────────────
// Flight Service — The Business Brain
// Controllers are thin wrappers. All actual logic lives here.
// Services talk to MongoDB, enforce business rules, and throw ApiErrors.
// ─────────────────────────────────────────────────────────────────────────────

import { Aircraft as Flight } from "../models/aircraft.model.js";
import { FlightRoute } from "../models/flightRoute.model.js";
import { FlightSchedule } from "../models/flightSchedule.model.js";
import { FlightReview } from "../models/flightReview.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import Booking from "../../bookings/models/booking.model.js";
import { bulkUpsertCities } from "../../places/services/city.service.js";
import { bulkUpsertAirports } from "../services/airport.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT CRUD (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// Creates a new aircraft record for the given vendor.
// Enforces uniqueness on both flightNumber and registrationNumber.
export const createFlightService = async (operatorId, payload) => {
    // 1. Check for duplicate aircraft registration (tail number must be unique)
    const existingReg = await Flight.findOne({
        registrationNumber: payload.registrationNumber.toUpperCase(),
    });
    if (existingReg) {
        throw new ApiError(409, "A flight with this registration number already exists.");
    }

    // 2. Create the flight, injecting operatorId from the JWT token
    const flight = await Flight.create({
        ...payload,
        operatorId,
        registrationNumber: payload.registrationNumber.toUpperCase(),
    });

    return flight;
};

// Returns all aircraft owned by the logged-in vendor, newest first.
export const getVendorFlightsService = async (operatorId) => {
    return await Flight.find({ operatorId }).sort({ createdAt: -1 });
};

// Returns a single flight by its MongoDB _id.
export const getFlightByIdService = async (flightId) => {
    const flight = await Flight.findById(flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");
    return flight;
};

// Partially updates a flight's details. Enforces ownership and uniqueness.
export const updateFlightService = async (flightId, operatorId, updateData) => {
    const flight = await Flight.findById(flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");

    // ── OWNERSHIP CHECK ──
    // Even if someone knows the flight's ID, they cannot edit it unless
    // their operatorId matches the flight's stored operatorId.
    if (flight.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only update your own flights.");
    }

    // Duplicate check for registration number
    if (updateData.registrationNumber) {
        updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
        const dup = await Flight.findOne({
            registrationNumber: updateData.registrationNumber,
            _id: { $ne: flightId },
        });
        if (dup) throw new ApiError(409, "Another flight with this registration number already exists.");
    }

    // Object.assign merges new fields into the existing Mongoose document object
    Object.assign(flight, updateData);
    await flight.save(); // .save() triggers Mongoose validators before writing to DB
    return flight;
};

// Deletes a flight and CASCADE-deletes all its routes and schedules.
export const deleteFlightService = async (flightId, operatorId) => {
    const flight = await Flight.findById(flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");

    // ── OWNERSHIP CHECK ──
    if (flight.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only delete your own flights.");
    }

    // ── CASCADE DELETE ──
    // Without this, routes and schedules would become "orphaned" — they'd
    // reference a flight that no longer exists.
    await FlightSchedule.deleteMany({ flightId });
    await FlightRoute.deleteMany({ flightId });
    await Flight.findByIdAndDelete(flightId);

    return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT ROUTE MANAGEMENT (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// Creates a route (DEL → BOM with stops) for a specific aircraft.
export const createFlightRouteService = async (operatorId, routeData) => {
    // 1. Verify the aircraft exists
    const flight = await Flight.findById(routeData.flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");

    // 2. Verify ownership — vendor must own the aircraft to create routes for it
    if (flight.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create routes for your own flights.");
    }

    // 3. Sort stops by their `order` field ascending before saving.
    //    This normalizes data even if the client sends them out of order.
    routeData.stops.sort((a, b) => a.order - b.order);

    const route = await FlightRoute.create(routeData);

    // 4. ── AUTO-REGISTER CITIES & AIRPORTS ──
    // We register the city in the Places module, and the airport in the Flights module.
    const citiesToUpsert = [
        { name: routeData.source.city, state: routeData.source.country || "India" },
        { name: routeData.destination.city, state: routeData.destination.country || "India" },
        ...routeData.stops.map((stop) => ({ name: stop.city, state: stop.country || "India" })),
    ];

    const airportsToUpsert = [
        { iataCode: routeData.source.iataCode, name: routeData.source.name, city: routeData.source.city, country: routeData.source.country },
        { iataCode: routeData.destination.iataCode, name: routeData.destination.name, city: routeData.destination.city, country: routeData.destination.country },
        ...routeData.stops.map((stop) => ({ iataCode: stop.iataCode, name: stop.name, city: stop.city, country: stop.country })),
    ];

    bulkUpsertCities(citiesToUpsert).catch((err) =>
        console.error("[FlightService] Failed to auto-register cities for route:", err.message)
    );

    bulkUpsertAirports(airportsToUpsert).catch((err) =>
        console.error("[FlightService] Failed to auto-register airports for route:", err.message)
    );

    return route;
};

// Returns all routes defined for a specific aircraft.
export const getRoutesForFlightService = async (flightId) => {
    return await FlightRoute.find({ flightId }).sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT SCHEDULE MANAGEMENT (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// Creates a scheduled trip for a flight on a specific date.
// This copies the aircraft's seat layout into the schedule as an independent snapshot.
export const createFlightScheduleService = async (operatorId, scheduleData) => {
    const { routeId, flightId, departureDate, departureTime, arrivalTime, baseFare } = scheduleData;

    // 1. Verify the aircraft exists and belongs to this vendor
    const flight = await Flight.findById(flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");
    if (flight.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create schedules for your own flights.");
    }

    // 2. Verify the route exists and actually belongs to this aircraft
    const route = await FlightRoute.findById(routeId);
    if (!route) throw new ApiError(404, "Route not found.");
    if (route.flightId.toString() !== flightId) {
        throw new ApiError(400, "This route does not belong to the specified flight.");
    }

    // 3. Duplicate check: prevent two schedules for the same aircraft on the same
    //    date at the same departure time. Uses the unique index defined on the model.
    const duplicate = await FlightSchedule.findOne({
        flightId,
        departureDate: new Date(departureDate),
        departureTime,
    });
    if (duplicate) {
        throw new ApiError(409, "A schedule already exists for this flight on this date and time.");
    }

    // 4. ── THE SEAT SNAPSHOT ──
    // Copy the aircraft's `seatLayout` template into this specific trip's `seats`.
    // We add the booking-specific fields (status, bookedBy, etc.) with defaults.
    // This snapshot is completely independent from every other trip's seats.
    const seats = flight.seatLayout.map((seat) => ({
        seatNumber: seat.seatNumber,
        cabinClass: seat.cabinClass,
        seatType: seat.seatType,
        row: seat.row,
        column: seat.column,
        isExtraLegroom: seat.isExtraLegroom,
        // Use the seat-specific fare if defined, otherwise fall back to baseFare
        fare: seat.fare || baseFare,
        status: "AVAILABLE", // All seats start available on a new schedule
        bookedBy: null,
        passengerName: null,
        passengerAge: null,
        passengerGender: null,
    }));

    // Determine arrival date: use the provided arrivalDate or default to the departure date
    // (covers same-day flights, which is the majority of domestic routes)
    const arrivalDate = scheduleData.arrivalDate
        ? new Date(scheduleData.arrivalDate)
        : new Date(departureDate);

    const schedule = await FlightSchedule.create({
        routeId,
        flightId,
        flightNumber: scheduleData.flightNumber,
        operatorId,
        departureDate: new Date(departureDate),
        arrivalDate,
        departureTime,
        arrivalTime,
        baseFare,
        availableSeats: seats.length, // All seats available at creation
        seats,
        departureTerminal: scheduleData.departureTerminal || "",
        arrivalTerminal: scheduleData.arrivalTerminal || "",
        mealOptions: scheduleData.mealOptions || [],
        // Apply a sensible default refund policy if the vendor didn't provide one
        cancellationPolicy: scheduleData.cancellationPolicy || [
            { hoursBeforeDeparture: 24, refundPercentage: 75 },
            { hoursBeforeDeparture: 12, refundPercentage: 50 },
            { hoursBeforeDeparture: 6,  refundPercentage: 25 },
            { hoursBeforeDeparture: 0,  refundPercentage: 0  },
        ],
    });

    return schedule;
};

export const getVendorFlightSchedulesService = async (operatorId) => {
    // Return all flight schedules belonging to the vendor, sorted by departure date.
    // Populate the flightId and routeId to provide meaningful data.
    const schedules = await FlightSchedule.find({ operatorId })
        .populate({ path: "flightId", select: "airlineName registrationNumber aircraftModel" })
        .populate({ path: "routeId", select: "source destination" })
        .select("-seats") // Exclude the huge seats array for performance
        .sort({ departureDate: 1, departureTime: 1 });
        
    return schedules;
};

export const getFlightScheduleByIdService = async (scheduleId) => {
    const schedule = await FlightSchedule.findById(scheduleId)
        .populate({ path: "flightId", select: "airlineName registrationNumber aircraftModel aircraftType cabinClasses amenities averageRating photos operatorName totalSeats" })
        .populate({ path: "routeId", select: "source destination stops distanceInKm estimatedDurationInMinutes" })
        .select("-seats");
        
    if (!schedule) throw new ApiError(404, "Schedule not found");
    
    return {
        scheduleId: schedule._id,
        flight: schedule.flightId,
        route: schedule.routeId,
        departureDate: schedule.departureDate,
        arrivalDate: schedule.arrivalDate,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        departureTerminal: schedule.departureTerminal,
        arrivalTerminal: schedule.arrivalTerminal,
        baseFare: schedule.baseFare,
        availableSeats: schedule.availableSeats,
        totalSeats: schedule.seats ? schedule.seats.length : (schedule.flightId?.totalSeats || schedule.availableSeats),
        mealOptions: schedule.mealOptions,
        cancellationPolicy: schedule.cancellationPolicy,
        status: schedule.status,
    };
};
// Returns full seat map + flight/route details for the frontend to render.
export const getFlightScheduleSeatsService = async (scheduleId) => {
    // .populate() replaces the stored ObjectId with the full referenced document.
    // `select` limits which fields are returned to keep the payload lean.
    const schedule = await FlightSchedule.findById(scheduleId)
        .populate({
            path: "flightId",
            select: "airlineName aircraftType aircraftModel cabinClasses amenities averageRating photos operatorName totalSeats",
        })
        .populate({
            path: "routeId",
            select: "source destination stops distanceInKm estimatedDurationInMinutes",
        });

    if (!schedule) throw new ApiError(404, "Schedule not found.");

    // Return a flattened, frontend-friendly object
    return {
        scheduleId: schedule._id,
        flight: schedule.flightId,      // Populated flight object
        route: schedule.routeId,         // Populated route object
        departureDate: schedule.departureDate,
        arrivalDate: schedule.arrivalDate,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        departureTerminal: schedule.departureTerminal,
        arrivalTerminal: schedule.arrivalTerminal,
        baseFare: schedule.baseFare,
        availableSeats: schedule.availableSeats,
        totalSeats: schedule.seats.length,
        seats: schedule.seats,           // Full seat-by-seat status array
        mealOptions: schedule.mealOptions,
        cancellationPolicy: schedule.cancellationPolicy,
        status: schedule.status,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (Public — no auth required)
// ─────────────────────────────────────────────────────────────────────────────

// Searches for available flights between two locations on a given date.
// Supports both IATA code search ("DEL") and city name search ("Delhi").
// Also supports multi-stop routes (layovers).
export const searchFlightsService = async (from, to, date, filters = {}) => {
    // Build case-insensitive regex for both the `from` and `to` inputs.
    // This lets "delhi" match "Delhi", and "DEL" match "DEL".
    const fromRegex = new RegExp(`^${from}$`, "i");
    const toRegex = new RegExp(`^${to}$`, "i");

    // ── STEP 1: Find matching routes ──────────────────────────────────────
    // We look for routes where BOTH the from-airport AND the to-airport
    // appear somewhere in the stops array (which includes source and destination).
    // Using $or on both sides allows partial-route matching (layover cities).
    const routes = await FlightRoute.find({
        status: "ACTIVE",
        $and: [
            {
                // The "from" location must exist somewhere in the route
                $or: [
                    { "source.iataCode": fromRegex },
                    { "source.city": fromRegex },
                    { "stops.iataCode": fromRegex },
                    { "stops.city": fromRegex },
                ],
            },
            {
                // The "to" location must exist somewhere in the route
                $or: [
                    { "destination.iataCode": toRegex },
                    { "destination.city": toRegex },
                    { "stops.iataCode": toRegex },
                    { "stops.city": toRegex },
                ],
            },
        ],
    });

    if (routes.length === 0) return []; // No matching routes at all

    // ── STEP 2: Verify travel direction ───────────────────────────────────
    // A route containing both DEL and BOM doesn't mean it goes DEL→BOM.
    // We use the `order` field on each stop to enforce direction.
    const validRoutes = [];

    for (const route of routes) {
        // Find the stop objects matching the from/to inputs
        const fromStop = route.stops.find(
            (s) => fromRegex.test(s.iataCode) || fromRegex.test(s.city)
        );
        const toStop = route.stops.find(
            (s) => toRegex.test(s.iataCode) || toRegex.test(s.city)
        );

        // Only include if: both stops found AND from comes BEFORE to in the route
        if (fromStop && toStop && fromStop.order < toStop.order) {
            validRoutes.push({
                routeId: route._id,
                boardingStop: fromStop,  // The stop where the passenger boards
                droppingStop: toStop,    // The stop where the passenger alights
            });
        }
    }

    if (validRoutes.length === 0) return [];

    const routeIds = validRoutes.map((r) => r.routeId);

    // ── STEP 3: Find schedules on these routes for the given date ─────────
    const searchDate = new Date(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const scheduleQuery = {
        routeId: { $in: routeIds },
        departureDate: { $gte: searchDate, $lt: nextDay },
        status: "SCHEDULED",
        availableSeats: { $gt: 0 }, // Skip fully booked flights
    };

    // ── STEP 4: Apply flight-level filters ────────────────────────────────
    const flightQuery = {};
    if (filters.aircraftType) flightQuery.aircraftType = filters.aircraftType;
    if (filters.cabinClass) {
        flightQuery.cabinClasses = { $in: [filters.cabinClass.toUpperCase()] };
    }

    // ── STEP 5: Execute query with DB-level joins (populate) ──────────────
    let schedules = await FlightSchedule.find(scheduleQuery)
        .populate({
            path: "flightId",
            select: "airlineName aircraftType aircraftModel cabinClasses amenities averageRating totalRatings photos operatorName totalSeats",
            // `match` acts like an inner join — if the flight doesn't satisfy
            // the filter, Mongoose sets flightId to null for that schedule.
            match: Object.keys(flightQuery).length > 0 ? flightQuery : undefined,
        })
        .populate({
            path: "routeId",
            select: "source destination stops distanceInKm estimatedDurationInMinutes",
        })
        // Exclude the large `seats` array from search results — passengers
        // only need the seat map when they click into a specific flight.
        .select("-seats")
        .sort({ departureTime: 1 }); // Earliest flights first

    // Remove schedules whose flight was filtered out (flightId is null)
    schedules = schedules.filter((s) => s.flightId !== null);

    // ── STEP 6: Enrich results and format to frontend-friendly shape ───────
    const routeMap = new Map(validRoutes.map((r) => [r.routeId.toString(), r]));

    schedules = schedules.map((schedule) => {
        const s = schedule.toObject();
        const routeInfo = routeMap.get(schedule.routeId._id.toString());

        // Calculate partial-segment duration if boarding/dropping stops have timing data
        let durationMinutes = s.routeId?.estimatedDurationInMinutes;
        if (routeInfo) {
            const segmentDuration =
                routeInfo.droppingStop.minutesFromSource -
                routeInfo.boardingStop.minutesFromSource;
            if (segmentDuration > 0) durationMinutes = segmentDuration;
        }

        return {
            scheduleId: s._id,
            operator: {
                id: s.operatorId,
                name: s.flightId?.operatorName || "Unknown",
            },
            flight: {
                id: s.flightId?._id,
                airlineName: s.flightId?.airlineName,
                flightNumber: s.flightNumber,
                aircraftType: s.flightId?.aircraftType,
                aircraftModel: s.flightId?.aircraftModel,
                cabinClasses: s.flightId?.cabinClasses || [],
                amenities: s.flightId?.amenities || [],
                rating: s.flightId?.averageRating || 0,
            },
            journey: {
                departureDate: s.departureDate,
                arrivalDate: s.arrivalDate,
                departureTime: s.departureTime,
                arrivalTime: s.arrivalTime,
                durationMinutes,
                source: routeInfo
                    ? `${routeInfo.boardingStop.city} (${routeInfo.boardingStop.iataCode})`
                    : `${s.routeId?.source?.city} (${s.routeId?.source?.iataCode})`,
                destination: routeInfo
                    ? `${routeInfo.droppingStop.city} (${routeInfo.droppingStop.iataCode})`
                    : `${s.routeId?.destination?.city} (${s.routeId?.destination?.iataCode})`,
                departureTerminal: s.departureTerminal,
                arrivalTerminal: s.arrivalTerminal,
            },
            pricing: {
                baseFare: s.baseFare,
            },
            seats: {
                available: s.availableSeats,
                total: s.flightId?.totalSeats || s.availableSeats,
            },
            mealOptions: s.mealOptions,
            cancellationPolicy: (s.cancellationPolicy || []).map((cp) => ({
                hoursBeforeDeparture: cp.hoursBeforeDeparture,
                refundPercentage: cp.refundPercentage,
            })),
            status: s.status,
        };
    });

    // ── STEP 7: Apply price filters (post-query, in memory) ───────────────
    if (filters.minPrice) {
        schedules = schedules.filter((s) => s.pricing.baseFare >= Number(filters.minPrice));
    }
    if (filters.maxPrice) {
        schedules = schedules.filter((s) => s.pricing.baseFare <= Number(filters.maxPrice));
    }

    // ── STEP 8: Apply sorting ─────────────────────────────────────────────
    if (filters.sortBy === "price_low") {
        schedules.sort((a, b) => a.pricing.baseFare - b.pricing.baseFare);
    } else if (filters.sortBy === "price_high") {
        schedules.sort((a, b) => b.pricing.baseFare - a.pricing.baseFare);
    } else if (filters.sortBy === "rating") {
        schedules.sort((a, b) => b.flight.rating - a.flight.rating);
    } else if (filters.sortBy === "duration") {
        schedules.sort((a, b) => (a.journey.durationMinutes || 0) - (b.journey.durationMinutes || 0));
    } else if (filters.sortBy === "departure") {
        schedules.sort((a, b) =>
            a.journey.departureTime.localeCompare(b.journey.departureTime)
        );
    }

    return schedules;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEAT BLOCKING (Phase 1 — before actual booking)
// ─────────────────────────────────────────────────────────────────────────────

// Temporarily locks a set of seats in Redis for 10 minutes.
// This prevents two users from booking the same seat simultaneously.
// The actual BOOKED status is only written when the payment/booking completes.
export const blockSeatsService = async (userId, scheduleId, seatNumbers) => {
    // 1. Fetch the schedule and validate it exists
    const schedule = await FlightSchedule.findById(scheduleId);
    if (!schedule) throw new ApiError(404, "Schedule not found.");

    // 2. Validate every requested seat before acquiring any locks
    const validSeats = [];
    for (const seatNumber of seatNumbers) {
        const seat = schedule.seats.find((s) => s.seatNumber === seatNumber);

        if (!seat) {
            throw new ApiError(400, `Seat ${seatNumber} does not exist on this flight.`);
        }
        if (seat.status === "BOOKED") {
            throw new ApiError(409, `Seat ${seatNumber} is already booked.`);
        }

        // Check if another user has already locked this seat in Redis
        const lockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
        const existingLock = await redis.get(lockKey);

        if (existingLock && existingLock !== userId.toString()) {
            throw new ApiError(
                409,
                `Seat ${seatNumber} is currently being booked by another user. Please try again later.`
            );
        }

        validSeats.push(seatNumber);
    }

    // 3. Acquire Redis locks using a pipeline (batches all SET commands in one round-trip)
    const TTL_SECONDS = 600; // 10 minutes — enough time to complete payment
    const pipeline = redis.pipeline();

    for (const seatNumber of validSeats) {
        const lockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
        // SET key value EX ttl — stores the userId as the lock owner
        pipeline.set(lockKey, userId.toString(), "EX", TTL_SECONDS);

        // Also update the Mongoose document so the UI reflects BLOCKED immediately
        const seatIndex = schedule.seats.findIndex((s) => s.seatNumber === seatNumber);
        if (seatIndex !== -1) {
            schedule.seats[seatIndex].status = "BLOCKED";
        }
    }

    await pipeline.exec();
    await schedule.save();

    // 4. Schedule an auto-unblock job after the TTL expires.
    // In production, use BullMQ or AWS SQS. setTimeout works at our current scale.
    setTimeout(async () => {
        try {
            const sched = await FlightSchedule.findById(scheduleId);
            if (!sched) return;

            let changed = false;
            for (const seatNumber of validSeats) {
                const lockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
                const lockValue = await redis.get(lockKey);

                // Lock missing = either expired or consumed by a completed booking
                if (!lockValue) {
                    const idx = sched.seats.findIndex((s) => s.seatNumber === seatNumber);
                    // Only revert BLOCKED seats (not BOOKED — booking service owns those)
                    if (idx !== -1 && sched.seats[idx].status === "BLOCKED") {
                        sched.seats[idx].status = "AVAILABLE";
                        changed = true;
                    }
                }
            }
            if (changed) await sched.save();
        } catch (err) {
            console.error("Error in flight seat unblocking job:", err);
        }
    }, (TTL_SECONDS + 5) * 1000); // Run slightly after TTL to avoid race conditions

    return {
        message: "Seats blocked successfully for 10 minutes.",
        expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE CANCEL (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────
//
// When the airline cancels a flight, all passengers get a 100% refund.
// Industry standard: the passenger has zero fault when the operator cancels.
// ─────────────────────────────────────────────────────────────────────────────
export const cancelFlightScheduleService = async (operatorId, scheduleId) => {
    // 1. Fetch and verify ownership
    const schedule = await FlightSchedule.findById(scheduleId);
    if (!schedule) throw new ApiError(404, "Schedule not found.");

    if (schedule.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only cancel your own schedules.");
    }

    // 2. Guard against cancelling terminal-state schedules
    if (schedule.status === "CANCELLED") {
        throw new ApiError(409, "This schedule is already cancelled.");
    }
    if (schedule.status === "COMPLETED") {
        throw new ApiError(400, "A completed schedule cannot be cancelled.");
    }
    if (schedule.status === "DEPARTED") {
        throw new ApiError(400, "Cannot cancel a flight that has already departed.");
    }

    // 3. Find all confirmed bookings for this schedule
    const affectedBookings = await Booking.find({
        scheduleId,
        bookingStatus: "CONFIRMED",
    });

    // 4. Issue 100% refunds to all affected passengers
    const cancelledCount = affectedBookings.length;
    for (const booking of affectedBookings) {
        booking.bookingStatus = "CANCELLED";
        booking.paymentStatus = "REFUNDED";
        booking.refundAmount  = booking.totalFare; // Full refund — airline's fault
        booking.cancelledAt   = new Date();
        await booking.save();
    }

    // 5. Mark the schedule itself as CANCELLED
    schedule.status = "CANCELLED";
    await schedule.save();

    return {
        scheduleId,
        cancelledBookings: cancelledCount,
        message:
            cancelledCount > 0
                ? `Schedule cancelled. ${cancelledCount} booking(s) have been refunded in full.`
                : "Schedule cancelled. No active bookings were affected.",
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS AND RATINGS
// ─────────────────────────────────────────────────────────────────────────────

// Adds a passenger review for a flight and updates the aircraft's average rating.
export const addFlightReviewService = async (userId, flightId, bookingId, rating, reviewText) => {
    // 1. Verify the flight exists
    const flight = await Flight.findById(flightId);
    if (!flight) throw new ApiError(404, "Flight not found.");

    // 2. Prevent duplicate reviews — one review per booking
    const existing = await FlightReview.findOne({ bookingId });
    if (existing) throw new ApiError(409, "You have already reviewed this flight.");

    // 3. Create the review document
    const review = await FlightReview.create({
        userId,
        flightId,
        bookingId,
        rating,
        review: reviewText,
    });

    // 4. Recompute the flight's average rating using MongoDB aggregation.
    //    $avg and $sum are calculated across ALL reviews for this flight.
    const stats = await FlightReview.aggregate([
        { $match: { flightId: flight._id } },
        {
            $group: {
                _id: "$flightId",
                avgRating: { $avg: "$rating" },
                totalRatings: { $sum: 1 },
            },
        },
    ]);

    if (stats.length > 0) {
        // Round to 1 decimal place (e.g., 4.266… → 4.3)
        flight.averageRating = Math.round(stats[0].avgRating * 10) / 10;
        flight.totalRatings  = stats[0].totalRatings;
        await flight.save();
    }

    return review;
};
