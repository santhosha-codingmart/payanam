// ─────────────────────────────────────────────────────────────────────────────
// Bus Service — The Business Brain
// This is where all the actual work happens. Controllers just pass data here.
// Services interact with MongoDB (via Mongoose models), enforce business rules
// (like "only the owner can edit this"), and throw ApiErrors if things go wrong.
// ─────────────────────────────────────────────────────────────────────────────

import { Bus } from "../models/bus.model.js";
import { Route } from "../models/route.model.js";
import { Schedule } from "../models/schedule.model.js";
import { ApiError } from "../../../utils/ApiError.js";

// ─────────────────────────────────────────────────────────────────────────────
// BUS CRUD (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createBusService = async (operatorId, payload) => {
    // 1. Enforce uniqueness: Bus registration numbers must be globally unique
    const existing = await Bus.findOne({
        registrationNumber: payload.registrationNumber.toUpperCase(),
    });
    if (existing) {
        throw new ApiError(409, "A bus with this registration number already exists.");
    }

    // 2. Enforce uniqueness: Bus numbers must also be unique
    const existingBusNum = await Bus.findOne({
        busNumber: payload.busNumber.toUpperCase(),
    });
    if (existingBusNum) {
        throw new ApiError(409, "A bus with this bus number already exists.");
    }

    // 3. Create the bus. Notice we inject `operatorId` here from the token,
    // ensuring the vendor who made the request is set as the owner.
    const bus = await Bus.create({
        ...payload,
        operatorId,
        registrationNumber: payload.registrationNumber.toUpperCase(),
        busNumber: payload.busNumber.toUpperCase(),
    });

    return bus;
};

// Gets all buses owned by the logged-in vendor
export const getVendorBusesService = async (operatorId) => {
    // We sort by createdAt: -1 to show the newest buses first
    return await Bus.find({ operatorId }).sort({ createdAt: -1 });
};

// Gets a specific bus by its ID. Used by vendors to view their own bus details,
// or by admins.
export const getBusByIdService = async (busId) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    return bus;
};

// Updates a bus's details (partial update)
export const updateBusService = async (busId, operatorId, updateData) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }

    // ── OWNERSHIP CHECK ──
    // This is crucial. Even if you have the ID of another vendor's bus,
    // you cannot edit it unless your operatorId matches the bus's operatorId.
    // We use .toString() because MongoDB ObjectIds are objects, not strings.
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only update your own buses.");
    }

    // If registration number is being changed, we must verify the new one
    // isn't already taken by SOME OTHER bus (_id: { $ne: busId }).
    if (updateData.registrationNumber) {
        updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
        const duplicate = await Bus.findOne({
            registrationNumber: updateData.registrationNumber,
            _id: { $ne: busId }, // $ne = not equal
        });
        if (duplicate) {
            throw new ApiError(409, "Another bus with this registration number already exists.");
        }
    }

    // Same duplicate check for busNumber
    if (updateData.busNumber) {
        updateData.busNumber = updateData.busNumber.toUpperCase();
        const duplicate = await Bus.findOne({
            busNumber: updateData.busNumber,
            _id: { $ne: busId },
        });
        if (duplicate) {
            throw new ApiError(409, "Another bus with this bus number already exists.");
        }
    }

    // Object.assign merges the new fields into the existing Mongoose document
    Object.assign(bus, updateData);
    await bus.save(); // Save triggers Mongoose validation before writing to DB
    return bus;
};

// Deletes a bus and everything associated with it
export const deleteBusService = async (busId, operatorId) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }

    // ── OWNERSHIP CHECK ──
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only delete your own buses.");
    }

    // ── CASCADE DELETE ──
    // If we just deleted the bus, we would leave "orphaned" routes and schedules
    // in the database that point to a bus that no longer exists.
    // So we delete them first.
    await Schedule.deleteMany({ busId });
    await Route.deleteMany({ busId });
    
    // Finally, delete the bus itself
    await Bus.findByIdAndDelete(busId);

    return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE MANAGEMENT (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createRouteService = async (operatorId, routeData) => {
    // 1. Verify the bus exists
    const bus = await Bus.findById(routeData.busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    
    // 2. Verify the vendor actually owns this bus
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create routes for your own buses.");
    }

    // 3. Ensure stops are sorted by their `order` property ascending.
    // This protects against a frontend bug sending them out of order.
    routeData.stops.sort((a, b) => a.order - b.order);

    const route = await Route.create(routeData);
    return route;
};

// Fetch all routes defined for a specific bus
export const getRoutesForBusService = async (busId) => {
    return await Route.find({ busId }).sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE MANAGEMENT (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createScheduleService = async (operatorId, scheduleData) => {
    const { routeId, busId, departureDate, arrivalDate, departureTime, arrivalTime, baseFare } = scheduleData;

    // 1. Verify bus exists and belongs to vendor
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create schedules for your own buses.");
    }

    // 2. Verify route exists and actually belongs to this bus
    const route = await Route.findById(routeId);
    if (!route) {
        throw new ApiError(404, "Route not found.");
    }
    if (route.busId.toString() !== busId) {
        throw new ApiError(400, "This route does not belong to the specified bus.");
    }

    // 3. Duplicate check: Prevent creating two trips for the exact same bus
    // at the exact same time on the exact same date.
    const duplicate = await Schedule.findOne({
        busId,
        departureDate: new Date(departureDate),
        departureTime,
    });
    if (duplicate) {
        throw new ApiError(409, "A schedule already exists for this bus on this date and time.");
    }

    // 4. ── THE SEAT SNAPSHOT ──
    // Here we take the bus's `seatLayout` template and create a new array
    // of seats for this specific trip. We add the `status: "AVAILABLE"` field.
    const seats = bus.seatLayout.map((seat) => ({
        seatNumber: seat.seatNumber,
        seatType: seat.seatType,
        deck: seat.deck,
        row: seat.row,
        column: seat.column,
        isSleeper: seat.isSleeper,
        fare: seat.fare || baseFare,
        status: "AVAILABLE", // Default status
        bookedBy: null,
        passengerName: null,
        passengerAge: null,
        passengerGender: null,
    }));

    const schedule = await Schedule.create({
        routeId,
        busId,
        operatorId,
        departureDate: new Date(departureDate),
        arrivalDate: new Date(arrivalDate),
        departureTime,
        arrivalTime,
        baseFare,
        availableSeats: seats.length, // Start with all seats available
        seats,
        boardingPoints: scheduleData.boardingPoints || [],
        droppingPoints: scheduleData.droppingPoints || [],
        // Apply default refund policy if the vendor didn't provide one
        cancellationPolicy: scheduleData.cancellationPolicy || [
            { hoursBeforeDeparture: 24, refundPercentage: 75 },
            { hoursBeforeDeparture: 12, refundPercentage: 50 },
            { hoursBeforeDeparture: 6, refundPercentage: 25 },
            { hoursBeforeDeparture: 0, refundPercentage: 0 },
        ],
    });

    return schedule;
};

// Gets the full seat map for a specific trip, used by the frontend to render the bus layout
export const getScheduleSeatsService = async (scheduleId) => {
    // ── .populate() ──
    // Schedule only stores `busId` and `routeId`.
    // .populate() tells Mongoose to automatically fetch the related Bus and Route
    // documents and replace the ID with the actual object.
    // The `select` option tells it to only fetch the fields we actually need.
    const schedule = await Schedule.findById(scheduleId)
        .populate({ path: "busId", select: "busName busType busNumber amenities seatLayoutType photos averageRating" })
        .populate({ path: "routeId", select: "source destination stops distanceInKm estimatedDurationInMinutes" });

    if (!schedule) {
        throw new ApiError(404, "Schedule not found.");
    }

    // We return a flattened object that's easy for the frontend to consume
    return {
        scheduleId: schedule._id,
        bus: schedule.busId,         // Populated bus object
        route: schedule.routeId,     // Populated route object
        departureDate: schedule.departureDate,
        arrivalDate: schedule.arrivalDate,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        baseFare: schedule.baseFare,
        availableSeats: schedule.availableSeats,
        totalSeats: schedule.seats.length,
        seats: schedule.seats,       // The actual array of seat statuses
        boardingPoints: schedule.boardingPoints,
        droppingPoints: schedule.droppingPoints,
        cancellationPolicy: schedule.cancellationPolicy,
        status: schedule.status,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (Public — No auth required)
// ─────────────────────────────────────────────────────────────────────────────

export const searchBusesService = async (from, to, date, filters = {}) => {
    // Use regex to allow case-insensitive searching (e.g., "chennai" matches "Chennai")
    // ^ means "start of string", $ means "end of string", "i" means case-insensitive
    const fromRegex = new RegExp(`^${from}$`, "i");
    const toRegex = new RegExp(`^${to}$`, "i");

    // ── STEP 1: Find matching routes ──
    // We look for routes where BOTH the "from" city AND "to" city exist somewhere
    // in the route (either as the main source/destination, OR in the stops array).
    const routes = await Route.find({
        status: "ACTIVE",
        $and: [
            {
                $or: [
                    { "source.city": fromRegex },
                    { "stops.city": fromRegex },
                ],
            },
            {
                $or: [
                    { "destination.city": toRegex },
                    { "stops.city": toRegex },
                ],
            },
        ],
    });

    if (routes.length === 0) {
        return []; // No routes exist between these two cities
    }

    // ── STEP 2: Verify direction ──
    // Just because a route contains both cities doesn't mean it goes in the right direction!
    // E.g., a Chennai→Bangalore route has both cities, but we shouldn't show it for
    // a Bangalore→Chennai search.
    const validRoutes = [];

    for (const route of routes) {
        // Find the specific objects in the `stops` array for the requested cities
        const fromStop = route.stops.find((s) => fromRegex.test(s.city));
        const toStop = route.stops.find((s) => toRegex.test(s.city));

        // Ensure the "from" city comes BEFORE the "to" city in the route's order
        if (fromStop && toStop && fromStop.order < toStop.order) {
            validRoutes.push({
                routeId: route._id,
                boardingStop: fromStop,
                droppingStop: toStop,
                farePerKm: route.farePerKm || 0,
                totalDistanceInKm: route.distanceInKm,
            });
        }
    }

    if (validRoutes.length === 0) {
        return [];
    }

    // Get an array of just the valid route IDs
    const routeIds = validRoutes.map((r) => r.routeId);

    // ── STEP 3: Find schedules for these routes on the given date ──
    const searchDate = new Date(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1); // Used to query a 24-hour window

    const scheduleQuery = {
        routeId: { $in: routeIds },
        // departureDate is >= searchDate AND < nextDay
        departureDate: { $gte: searchDate, $lt: nextDay },
        status: "SCHEDULED",
        availableSeats: { $gt: 0 }, // Don't show fully booked buses
    };

    // ── STEP 4: Apply frontend filters (Bus Level) ──
    const busQuery = {};
    if (filters.busType) {
        busQuery.busType = filters.busType;
    }
    if (filters.isAC !== undefined) {
        busQuery.isAC = filters.isAC === "true"; // Convert string to boolean
    }

    // ── STEP 5: Execute the query with populations ──
    let query = Schedule.find(scheduleQuery)
        .populate({
            path: "busId",
            select: "busName busType busNumber amenities seatLayoutType isAC isSleeper isSeater averageRating totalRatings photos operatorName totalSeats",
            // The `match` option here acts like an INNER JOIN condition.
            // If the bus doesn't match the busQuery (e.g., user wants AC but bus is Non-AC),
            // Mongoose will set `busId` to null for this schedule.
            match: Object.keys(busQuery).length > 0 ? busQuery : undefined,
        })
        .populate({
            path: "routeId",
            select: "source destination stops distanceInKm estimatedDurationInMinutes farePerKm",
        })
        // Exclude the massive `seats` array to keep the payload small.
        // Users will fetch the seat map later when they click on a specific bus.
        .select("-seats") 
        .sort({ departureTime: 1 }); // Sort by time ascending (morning to night)

    let schedules = await query;

    // Remove schedules where the bus was filtered out (busId is null)
    schedules = schedules.filter((s) => s.busId !== null);

    // ── STEP 6: Enrich results and format to Frontend-Friendly Contract ──
    const routeMap = new Map(validRoutes.map((r) => [r.routeId.toString(), r]));

    schedules = schedules.map((schedule) => {
        const scheduleObj = schedule.toObject();
        const routeInfo = routeMap.get(schedule.routeId._id.toString());
        
        let calculatedFare = scheduleObj.baseFare;

        if (routeInfo) {
            const segmentDistance = routeInfo.droppingStop.distanceFromSource - routeInfo.boardingStop.distanceFromSource;
            if (routeInfo.farePerKm > 0 && segmentDistance > 0) {
                calculatedFare = Math.round(routeInfo.farePerKm * segmentDistance);
            }
        }

        const filteredBoardingPoints = (scheduleObj.boardingPoints || []).filter(
            (bp) => fromRegex.test(bp.city)
        ).map(bp => ({
            id: bp._id,
            city: bp.city,
            name: bp.name,
            time: bp.time,
            address: bp.address,
            landmark: bp.landmark
        }));

        const filteredDroppingPoints = (scheduleObj.droppingPoints || []).filter(
            (dp) => toRegex.test(dp.city)
        ).map(dp => ({
            id: dp._id,
            city: dp.city,
            name: dp.name,
            time: dp.time,
            address: dp.address,
            landmark: dp.landmark
        }));
        
        const cancellationPolicy = (scheduleObj.cancellationPolicy || []).map(cp => ({
            hoursBeforeDeparture: cp.hoursBeforeDeparture,
            refundPercentage: cp.refundPercentage
        }));

        return {
            scheduleId: scheduleObj._id,
            operator: {
                id: scheduleObj.operatorId,
                name: scheduleObj.busId?.operatorName || "Unknown"
            },
            bus: {
                id: scheduleObj.busId?._id,
                name: scheduleObj.busId?.busName,
                number: scheduleObj.busId?.busNumber,
                type: scheduleObj.busId?.busType,
                layout: scheduleObj.busId?.seatLayoutType,
                isAC: scheduleObj.busId?.isAC,
                isSleeper: scheduleObj.busId?.isSleeper,
                isSeater: scheduleObj.busId?.isSeater,
                amenities: scheduleObj.busId?.amenities || [],
                rating: scheduleObj.busId?.averageRating || 0
            },
            journey: {
                departureDate: scheduleObj.departureDate,
                arrivalDate: scheduleObj.arrivalDate,
                departureTime: scheduleObj.departureTime,
                arrivalTime: scheduleObj.arrivalTime,
                durationMinutes: scheduleObj.routeId?.estimatedDurationInMinutes,
                source: routeInfo ? routeInfo.boardingStop.city : scheduleObj.routeId?.source.city,
                destination: routeInfo ? routeInfo.droppingStop.city : scheduleObj.routeId?.destination.city
            },
            pricing: {
                baseFare: scheduleObj.baseFare,
                calculatedFare: calculatedFare
            },
            seats: {
                available: scheduleObj.availableSeats,
                total: scheduleObj.busId?.totalSeats || scheduleObj.availableSeats
            },
            boardingPoints: filteredBoardingPoints,
            droppingPoints: filteredDroppingPoints,
            cancellationPolicy: cancellationPolicy,
            status: scheduleObj.status
        };
    });

    // ── STEP 7: Apply price filters ──
    if (filters.minPrice) {
        schedules = schedules.filter(
            (s) => s.pricing.calculatedFare >= Number(filters.minPrice)
        );
    }
    if (filters.maxPrice) {
        schedules = schedules.filter(
            (s) => s.pricing.calculatedFare <= Number(filters.maxPrice)
        );
    }

    // ── STEP 8: Apply sorting (if requested) ──
    if (filters.sortBy === "price_low") {
        schedules.sort((a, b) => a.pricing.calculatedFare - b.pricing.calculatedFare);
    } else if (filters.sortBy === "price_high") {
        schedules.sort((a, b) => b.pricing.calculatedFare - a.pricing.calculatedFare);
    } else if (filters.sortBy === "rating") {
        schedules.sort((a, b) => b.bus.rating - a.bus.rating);
    } else if (filters.sortBy === "departure") {
        schedules.sort((a, b) => a.journey.departureTime.localeCompare(b.journey.departureTime));
    }

    return schedules;
};