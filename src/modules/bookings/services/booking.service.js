// =============================================================================
// Booking Service — All business logic for the booking lifecycle
//
// WHY A SERVICE LAYER:
// Controllers should only handle HTTP concerns (extract req data, send res).
// All actual work — DB queries, Redis ops, business rule enforcement — lives
// here. This makes the logic testable and reusable across multiple controllers.
//
// DATA FLOW:
//   Controller extracts data from req
//   → passes to this service
//   → service queries MongoDB / Redis
//   → returns plain JS object to controller
//   → controller wraps it in res.json()
// =============================================================================

import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import { Bus } from "../../bus/models/bus.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";

// =============================================================================
// LADIES SEAT PROTECTION — Helper
// =============================================================================
//
// Rule: A male passenger CANNOT book a seat physically adjacent to a solo
//       female passenger who was booked by a DIFFERENT user/booking.
//
// Exception (allowed cases):
//   1. The current booking itself contains both male AND female passengers
//      (i.e. a couple/family booking) — they're together, so it's fine.
//   2. The adjacent booked female seat belongs to a booking that also has
//      male passengers (her booking companion is male — she's not solo).
//
// ADJACENCY RULES (physical next-to-each-other, not across the aisle):
//   2+2_SEATER  → pairs: (col1,col2) and (col3,col4) — aisle between 2 & 3
//   2+1_SLEEPER → pairs: (col1,col2) only — col3 is standalone
//   2+1_SEATER  → pairs: (col1,col2) only — col3 is standalone
//   1+1_SLEEPER → no adjacent pairs — aisle separates every berth
//
// HOW TO READ passengerGender:
//   Schedule stores "M" / "F" / "O"
//   Booking passengerDetails stores "male" / "female" / "other"
// =============================================================================

// Returns the column pairs that are physically adjacent for a given layout
const getAdjacentColumnPairs = (layoutType) => {
    switch (layoutType) {
        case "2+2_SEATER":   return [[1, 2], [3, 4]];
        case "2+1_SLEEPER":
        case "2+1_SEATER":   return [[1, 2]]; // col 3 is standalone
        case "1+1_SLEEPER":  return [];       // aisle between every berth
        default:             return [[1, 2]]; // safe fallback
    }
};

const checkLadiesSeatProtection = async (schedule, passengerDetails, layoutType) => {
    // ── Does this booking have any male passengers? ──
    const hasMales   = passengerDetails.some(p => p.gender === "male");
    const hasFemales = passengerDetails.some(p => p.gender === "female");

    // No males in this booking → no risk, skip entirely
    if (!hasMales) return;

    // Mixed-gender booking (couple / family travelling together) → allowed
    if (hasMales && hasFemales) return;

    // ── From here: this is a male-only booking ──
    // For every male passenger, check their adjacent seats on the schedule
    const adjacentPairs = getAdjacentColumnPairs(layoutType);

    for (const passenger of passengerDetails) {
        if (passenger.gender !== "male") continue;

        const mySeat = schedule.seats.find(s => s.seatNumber === passenger.seatNumber);
        if (!mySeat) continue;

        // Find all seats that are physically adjacent to this one
        const adjacentBookedFemaleSeats = schedule.seats.filter(s => {
            if (s.seatNumber === mySeat.seatNumber) return false;     // skip self
            if (s.status !== "BOOKED")              return false;     // only care about booked seats
            if (s.passengerGender !== "F")          return false;     // only female seats
            if (s.row  !== mySeat.row)              return false;     // must be same row
            if (s.deck !== mySeat.deck)             return false;     // must be same deck
            // Must be in the same adjacent column pair (not across the aisle)
            return adjacentPairs.some(([c1, c2]) =>
                (mySeat.column === c1 && s.column === c2) ||
                (mySeat.column === c2 && s.column === c1)
            );
        });

        for (const adjSeat of adjacentBookedFemaleSeats) {
            // Look up the booking that owns this adjacent female seat
            const adjBooking = await Booking.findOne({
                scheduleId: schedule._id,
                bookedSeats: adjSeat.seatNumber,
                bookingStatus: "CONFIRMED",
            }).select("passengerDetails");

            if (!adjBooking) continue; // Booking not found — skip (edge case)

            // Is the adjacent female travelling with any male companion
            // in her OWN booking?
            const adjacentBookingHasMale = adjBooking.passengerDetails.some(
                p => p.gender === "male"
            );

            // She has a male companion → she's not "solo" → our male can sit next to her
            if (adjacentBookingHasMale) continue;

            // She IS solo (or all-female group) → BLOCK the seat
            throw new ApiError(
                403,
                `Seat ${passenger.seatNumber} is directly adjacent to seat ${
                    adjSeat.seatNumber
                } which is occupied by a solo female passenger. ` +
                `As per our ladies safety policy, this seat cannot be booked by a male travelling alone.`
            );
        }
    }
};

// =============================================================================
// PHASE 2 — CREATE BOOKING
// =============================================================================
//
// Full booking flow:
//   1. Verify the seat block exists in Redis (user blocked them < 10 min ago)
//   2. Verify that the lock belongs to the current user (anti-theft check)
//   3. Load the Schedule to get seat fares, cancellation policy, etc.
//   3b. *** Ladies Seat Protection check ***
//   4. Validate passenger count matches booked seat count
//   5. Create the Booking document (PENDING status)
//   6. Mark each seat as BOOKED in the Schedule document
//      (also stores passengerGender so adjacent-seat checks work for future bookings)
//   7. Release the Redis locks (no longer needed — DB is the source of truth)
//   8. Simulate payment success (mock — no real gateway yet)
//   9. Confirm the booking (CONFIRMED status)
//  10. Return the full ticket details
//
// RACE CONDITION PROTECTION:
//   We use a Mongoose session (MongoDB transaction) so that steps 5+6 are
//   atomic. If the booking doc saves but the Schedule fails to update, the
//   whole operation rolls back — no orphaned bookings, no ghost seat marks.
// =============================================================================
export const createBookingService = async (userId, payload) => {
    const { scheduleId, boardingPointId, droppingPointId, passengerDetails } = payload;

    // ── STEP 1: Verify Redis seat locks ──────────────────────────────────────
    // seatNumbers are derived from the passenger list the user submitted
    const seatNumbers = passengerDetails.map((p) => p.seatNumber);

    // Fetch all lock values from Redis in a single pipeline call (efficient)
    const pipeline = redis.pipeline();
    for (const seatNumber of seatNumbers) {
        pipeline.get(`seat_lock:${scheduleId}:${seatNumber}`);
    }
    const lockResults = await pipeline.exec();
    // lockResults is [[err, value], [err, value], ...] — one per command

    for (let i = 0; i < seatNumbers.length; i++) {
        const [err, lockedBy] = lockResults[i];

        if (err) throw new ApiError(500, "Redis error while verifying seat locks.");

        // ── STEP 2: Verify the lock belongs to the current user ──────────────
        // If lockedBy is null → TTL expired and the block window has passed
        if (!lockedBy) {
            throw new ApiError(
                409,
                `Seat ${seatNumbers[i]} is no longer reserved. Please go back and re-select your seats.`
            );
        }

        // If lockedBy is a different userId → someone else owns this lock
        if (lockedBy !== userId.toString()) {
            throw new ApiError(
                409,
                `Seat ${seatNumbers[i]} was blocked by another user. Please choose different seats.`
            );
        }
    }

    // ── STEP 3: Load the Schedule ────────────────────────────────────────────
    // We need: seat fares, boarding/dropping points, cancellationPolicy, busId, routeId
    // We also need seatLayoutType from the bus to determine seat adjacency.
    const schedule = await Schedule.findById(scheduleId).populate(
        "busId",
        "seatLayoutType operatorId operatorName"
    );
    if (!schedule) throw new ApiError(404, "Schedule not found.");

    // ── STEP 3b: Ladies Seat Protection ─────────────────────────────────────
    // Checks if any male in this booking would sit next to a solo female
    // who was booked separately by a different user.
    const busLayoutType = schedule.busId?.seatLayoutType || "2+2_SEATER";
    await checkLadiesSeatProtection(schedule, passengerDetails, busLayoutType);

    // ── STEP 4: Validate passenger count matches seat count ──────────────────
    if (passengerDetails.length !== seatNumbers.length) {
        throw new ApiError(400, "Passenger count must match the number of booked seats.");
    }

    // ── Resolve boarding & dropping points ───────────────────────────────────
    // The frontend sends the ObjectId of the chosen point from the list
    const boardingPoint = schedule.boardingPoints.id(boardingPointId);
    if (!boardingPoint) throw new ApiError(400, "Invalid boarding point selected.");

    const droppingPoint = schedule.droppingPoints.id(droppingPointId);
    if (!droppingPoint) throw new ApiError(400, "Invalid dropping point selected.");

    // ── Calculate total fare ─────────────────────────────────────────────────
    // Sum each seat's individual fare from the Schedule's seats array
    let totalFare = 0;
    const seatFareMap = {};
    for (const seatNumber of seatNumbers) {
        const seat = schedule.seats.find((s) => s.seatNumber === seatNumber);
        if (!seat) throw new ApiError(400, `Seat ${seatNumber} does not exist on this schedule.`);
        if (seat.status === "BOOKED") {
            throw new ApiError(409, `Seat ${seatNumber} was just booked by another user.`);
        }
        seatFareMap[seatNumber] = seat.fare || schedule.baseFare;
        totalFare += seatFareMap[seatNumber];
    }

    // ── STEPS 5 & 6: MongoDB Transaction (atomic booking + seat marking) ────
    // WHY A SESSION: If the process crashes between creating the Booking and
    // updating the Schedule, we'd have a half-finished state. A transaction
    // ensures both writes succeed or both fail together.
    const session = await mongoose.startSession();
    let booking;

    try {
        await session.withTransaction(async () => {
            // 5a. Create the Booking document (status: PENDING)
            [booking] = await Booking.create(
                [
                    {
                        userId,
                        scheduleId,
                        busId: schedule.busId._id,
                        operatorId: schedule.busId.operatorId,
                        routeId: schedule.routeId,
                        boardingPoint: {
                            pointId: boardingPoint._id,
                            city: boardingPoint.city,
                            name: boardingPoint.name,
                            address: boardingPoint.address,
                            time: boardingPoint.time,
                        },
                        droppingPoint: {
                            pointId: droppingPoint._id,
                            city: droppingPoint.city,
                            name: droppingPoint.name,
                            address: droppingPoint.address,
                            time: droppingPoint.time,
                        },
                        passengerDetails,
                        bookedSeats: seatNumbers,
                        totalFare,
                        // Snapshot the cancellation policy in effect right now
                        cancellationPolicy: schedule.cancellationPolicy,
                        bookingStatus: "PENDING",
                        paymentStatus: "PENDING",
                    },
                ],
                { session }
            );

            // 5b. Mark each seat as BOOKED in the Schedule document
            // We also store passengerGender ("M"/"F"/"O") so that future
            // bookings can run the Ladies Seat Protection check against
            // already-booked seats without hitting the Booking collection.
            for (const seatNumber of seatNumbers) {
                const seatIndex = schedule.seats.findIndex(
                    (s) => s.seatNumber === seatNumber
                );
                if (seatIndex !== -1) {
                    const pax = passengerDetails.find((p) => p.seatNumber === seatNumber);
                    // Booking model uses "male"/"female"/"other";
                    // Schedule model uses "M"/"F"/"O" — map them here
                    const genderMap = { male: "M", female: "F", other: "O" };
                    schedule.seats[seatIndex].status          = "BOOKED";
                    schedule.seats[seatIndex].passengerName   = pax?.name   || "";
                    schedule.seats[seatIndex].passengerGender = genderMap[pax?.gender] ?? null;
                    schedule.seats[seatIndex].passengerAge    = pax?.age    ?? null;
                    schedule.seats[seatIndex].bookedBy        = userId;
                }
            }
            // Decrement availableSeats
            schedule.availableSeats = Math.max(
                0,
                schedule.availableSeats - seatNumbers.length
            );
            await schedule.save({ session });
        });
    } finally {
        // Always end the session whether transaction succeeded or failed
        session.endSession();
    }

    // ── STEP 7: Release Redis locks ──────────────────────────────────────────
    // The DB is now the source of truth — we no longer need the temporary locks.
    // Releasing them frees up Redis memory immediately instead of waiting for TTL.
    const delPipeline = redis.pipeline();
    for (const seatNumber of seatNumbers) {
        delPipeline.del(`seat_lock:${scheduleId}:${seatNumber}`);
    }
    await delPipeline.exec();

    // ── STEP 8 & 9: Mock payment + confirm booking ───────────────────────────
    // In production: integrate Razorpay/Stripe here.
    // For now we simulate an instant successful payment.
    const mockPaymentRef = `MOCK-PAY-${Date.now()}`;
    booking.paymentStatus = "SUCCESS";
    booking.bookingStatus = "CONFIRMED";
    booking.paymentReference = mockPaymentRef;
    booking.bookedAt = new Date();
    await booking.save();

    // ── STEP 10: Return the complete ticket ──────────────────────────────────
    return booking;
};

// =============================================================================
// PHASE 3 — GET BOOKING DETAILS
// =============================================================================
//
// WHY POPULATE:
// The Booking document stores only ObjectId references (scheduleId, busId, etc.)
// to avoid data duplication. When a user opens their ticket, we need the full
// human-readable data: bus name, route city names, operator info, etc.
// Mongoose's .populate() performs sub-queries to fill in those references.
//
// PERFORMANCE NOTE:
// In a high-traffic production app, you'd cache frequently-viewed tickets in
// Redis. For this project, the DB query is acceptable.
// =============================================================================
export const getBookingByIdService = async (userId, bookingId) => {
    // bookingId here is our custom "PAY-A3F2B1" string, NOT the MongoDB _id
    const booking = await Booking.findOne({ bookingId })
        .populate("userId", "name email phoneNo")       // User: only safe fields
        .populate("scheduleId", "departureDate departureTime arrivalTime arrivalDate baseFare")
        .populate({
            path: "busId",
            select: "busName busNumber busType seatLayoutType amenities operatorName",
        })
        .populate({
            path: "routeId",
            select: "source destination stops distanceInKm estimatedDurationInMinutes",
        });

    if (!booking) throw new ApiError(404, "Booking not found.");

    // Ownership check: only the user who made the booking can see it
    // (admins bypass this — but we handle that in the route/controller)
    if (booking.userId._id.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to view this booking.");
    }

    return booking;
};

// =============================================================================
// PHASE 3b — GET ALL BOOKINGS FOR A USER ("My Trips" page)
// =============================================================================
export const getMyBookingsService = async (userId) => {
    // Return a summarized list (not full details) for the "My Trips" listing page.
    // Sorted by bookedAt descending (most recent first).
    const bookings = await Booking.find({ userId })
        .sort({ bookedAt: -1 })
        .populate("busId", "busName busNumber busType operatorName")
        .populate("routeId", "source destination")
        .populate("scheduleId", "departureDate departureTime arrivalTime")
        .select(
            "bookingId bookingStatus paymentStatus totalFare bookedSeats bookedAt cancelledAt boardingPoint droppingPoint"
        );

    return bookings;
};

// =============================================================================
// VENDOR — GET ALL BOOKINGS ON THEIR BUSES
// =============================================================================
//
// WHY THIS EXISTS:
//   Vendors need a dashboard view showing every booking made on their buses.
//   The `operatorId` field is already stored on every Booking document at the
//   time of creation (copied from schedule.busId.operatorId), so this is just
//   a simple indexed query — no joins or extra lookups needed.
//
// FEATURES:
//   - Filter by bookingStatus (CONFIRMED / CANCELLED / PENDING)
//   - Filter by a specific scheduleId (e.g. view one trip's passengers)
//   - Pagination via page + limit query params
//   - Sorted by most recent booking first
//
// =============================================================================
export const getVendorBookingsService = async (operatorId, filters = {}) => {
    const { status, scheduleId, page = 1, limit = 20 } = filters;

    // ── Build query ────────────────────────────────────────────────────────────
    // operatorId is an indexed field on Booking — this query is fast.
    const query = { operatorId };

    if (status) {
        // Validate status is one of the enum values to prevent junk queries
        const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"];
        if (!validStatuses.includes(status.toUpperCase())) {
            throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
        }
        query.bookingStatus = status.toUpperCase();
    }

    if (scheduleId) {
        query.scheduleId = scheduleId;
    }

    // ── Pagination ─────────────────────────────────────────────────────────────
    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // cap at 100
    const skip     = (pageNum - 1) * limitNum;

    // ── Execute query in parallel with count ───────────────────────────────────
    // Running both queries simultaneously halves the response time vs sequential.
    const [bookings, totalCount] = await Promise.all([
        Booking.find(query)
            .sort({ bookedAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate("userId",     "name email phoneNo")        // passenger contact
            .populate("busId",      "busName busNumber busType")
            .populate("routeId",    "source destination")
            .populate("scheduleId", "departureDate departureTime arrivalTime")
            .select("-cancellationPolicy -__v"), // trim fields vendor doesn't need
        Booking.countDocuments(query),
    ]);

    return {
        bookings,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
};

// =============================================================================
// PHASE 4 — CANCEL BOOKING
// =============================================================================
//
// Cancellation lifecycle:
//   1. Find the booking by bookingId string
//   2. Verify it belongs to the current user
//   3. Verify it's in a CONFIRMED state (not already cancelled)
//   4. Calculate refund based on hours until departure + cancellationPolicy tiers
//   5. Release the seats back to AVAILABLE in the Schedule
//   6. Update booking status → CANCELLED, payment status → REFUNDED
//   7. Return refund details
//
// REFUND CALCULATION EXAMPLE:
//   Fare = ₹875, departure in 30 hours
//   Policy tiers (sorted by hoursBeforeDeparture DESC):
//     - 48h before → 100% refund  ← not matched (30 < 48)
//     - 24h before →  75% refund  ← MATCHED (30 > 24), so 75% refund
//     - 12h before →  50% refund
//     -  0h before →   0% refund
//   Refund = 875 * 0.75 = ₹656.25
//
// EDGE CASES:
//   - Departure already passed → 0% refund
//   - No matching tier → 0% refund (non-refundable)
// =============================================================================
export const cancelBookingService = async (userId, bookingId) => {
    // 1. Find booking
    const booking = await Booking.findOne({ bookingId });
    if (!booking) throw new ApiError(404, "Booking not found.");

    // 2. Ownership check
    if (booking.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to cancel this booking.");
    }

    // 3. Status check
    if (booking.bookingStatus === "CANCELLED") {
        throw new ApiError(409, "This booking is already cancelled.");
    }
    if (booking.bookingStatus !== "CONFIRMED") {
        throw new ApiError(400, "Only confirmed bookings can be cancelled.");
    }

    // 4. Calculate refund ─────────────────────────────────────────────────────
    const refundAmount = calculateRefund(booking);

    // 5. Release seats back to AVAILABLE ──────────────────────────────────────
    const schedule = await Schedule.findById(booking.scheduleId);
    if (schedule) {
        for (const seatNumber of booking.bookedSeats) {
            const seatIndex = schedule.seats.findIndex(
                (s) => s.seatNumber === seatNumber
            );
            if (seatIndex !== -1) {
                schedule.seats[seatIndex].status = "AVAILABLE";
                schedule.seats[seatIndex].passengerName = null;
            }
        }
        schedule.availableSeats += booking.bookedSeats.length;
        await schedule.save();
    }

    // 6. Update booking document ───────────────────────────────────────────────
    booking.bookingStatus = "CANCELLED";
    booking.paymentStatus = refundAmount > 0 ? "REFUNDED" : "SUCCESS"; // No refund = payment still succeeded
    booking.refundAmount = refundAmount;
    booking.cancelledAt = new Date();
    await booking.save();

    return {
        bookingId: booking.bookingId,
        refundAmount,
        cancelledAt: booking.cancelledAt,
        message:
            refundAmount > 0
                ? `Booking cancelled. Refund of ₹${refundAmount} will be credited in 5-7 business days.`
                : "Booking cancelled. No refund applicable as per cancellation policy.",
    };
};

// =============================================================================
// REFUND CALCULATION UTILITY
// =============================================================================
//
// This function isolates the refund logic so it can be unit-tested independently.
//
// HOW IT WORKS:
//   1. Calculate hours remaining until departure (right now vs. departure datetime)
//   2. Walk through the cancellationPolicy array sorted by hoursBeforeDeparture DESC
//   3. The first matching tier (hoursRemaining >= tier.hoursBeforeDeparture) wins
//   4. Refund = totalFare × (refundPercentage / 100)
// =============================================================================
export const calculateRefund = (booking) => {
    // Rebuild the departure datetime from the schedule snapshot in the booking
    // NOTE: We look this up from the booking's schedule for historical accuracy
    const departureDate = booking.departureDate;    // May be undefined; handled below
    if (!departureDate) return 0; // No date info = 0 refund as safe default

    const now = new Date();
    const hoursUntilDeparture = (departureDate - now) / (1000 * 60 * 60);

    // If departure has already passed, no refund
    if (hoursUntilDeparture <= 0) return 0;

    // Sort tiers: most generous (highest hours) first
    const sortedPolicy = [...(booking.cancellationPolicy || [])].sort(
        (a, b) => b.hoursBeforeDeparture - a.hoursBeforeDeparture
    );

    // Walk through tiers to find best matching refund
    for (const tier of sortedPolicy) {
        if (hoursUntilDeparture >= tier.hoursBeforeDeparture) {
            return Math.round((booking.totalFare * tier.refundPercentage) / 100);
        }
    }

    return 0; // No matching tier → non-refundable
};
