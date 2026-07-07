// =============================================================================
// PriceLock Service — Business logic for fare locking
//
// All price lock rules live here. Controllers are thin wrappers.
//
// LOCK FEE CALCULATION:
//   Fee scales with both the flight's base fare and the lock duration.
//   Longer locks cost more because the platform absorbs more risk.
//
// AUTO-EXPIRATION:
//   When a lock is created, a Redis key is set with TTL matching the duration.
//   A setTimeout callback auto-marks the lock as EXPIRED after the TTL.
//   In production, replace setTimeout with BullMQ or AWS SQS.
// =============================================================================

import PriceLock from "../models/priceLock.model.js";
import { FlightSchedule } from "../models/flightSchedule.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";

// ─── Lock Duration Configuration ─────────────────────────────────────────────
// Maps duration IDs to their properties: milliseconds, fee percentage, minimum fee.
const LOCK_DURATIONS = {
    "4h":  { label: "4 hours",  ms: 4 * 60 * 60 * 1000,   pct: 0.015, minFee: 99  },
    "8h":  { label: "8 hours",  ms: 8 * 60 * 60 * 1000,   pct: 0.020, minFee: 149 },
    "12h": { label: "12 hours", ms: 12 * 60 * 60 * 1000,  pct: 0.025, minFee: 199 },
    "1d":  { label: "1 day",    ms: 24 * 60 * 60 * 1000,   pct: 0.030, minFee: 299 },
    "3d":  { label: "3 days",   ms: 3 * 24 * 60 * 60 * 1000, pct: 0.040, minFee: 499 },
    "7d":  { label: "7 days",   ms: 7 * 24 * 60 * 60 * 1000, pct: 0.055, minFee: 799 },
};

// Maximum fare increase the platform absorbs per passenger
const PROTECTION_LIMIT = 7500;

// ─────────────────────────────────────────────────────────────────────────────
// Calculate the lock fee for a given fare and duration
// ─────────────────────────────────────────────────────────────────────────────
export const calculateLockFee = (baseFare, lockDurationId) => {
    const config = LOCK_DURATIONS[lockDurationId];
    if (!config) throw new ApiError(400, `Invalid lock duration: ${lockDurationId}`);
    // Fee = max(minimum fee, fare × percentage), rounded to nearest rupee
    return Math.max(config.minFee, Math.round(baseFare * config.pct));
};

// ─────────────────────────────────────────────────────────────────────────────
// Get lock options for a flight (used by the modal to show duration choices)
// ─────────────────────────────────────────────────────────────────────────────
export const getLockOptionsForFare = (baseFare) => {
    return Object.entries(LOCK_DURATIONS).map(([id, config]) => ({
        id,
        duration: config.label,
        fee: Math.max(config.minFee, Math.round(baseFare * config.pct)),
        flightPrice: baseFare,
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PRICE LOCK
// ─────────────────────────────────────────────────────────────────────────────
export const createPriceLockService = async (userId, scheduleId, lockDurationId) => {
    // 1. Validate duration
    const durationConfig = LOCK_DURATIONS[lockDurationId];
    if (!durationConfig) {
        throw new ApiError(400, `Invalid lock duration: ${lockDurationId}. Valid options: ${Object.keys(LOCK_DURATIONS).join(", ")}`);
    }

    // 2. Fetch the schedule with populated flight and route data
    const schedule = await FlightSchedule.findById(scheduleId)
        .populate({ path: "flightId", select: "airlineName" })
        .populate({ path: "routeId", select: "source destination" });

    if (!schedule) throw new ApiError(404, "Flight schedule not found.");
    if (schedule.status === "CANCELLED") throw new ApiError(400, "Cannot lock price for a cancelled flight.");
    if (schedule.status === "COMPLETED") throw new ApiError(400, "Cannot lock price for a completed flight.");
    if (schedule.status === "DEPARTED") throw new ApiError(400, "Cannot lock price for a departed flight.");

    // 3. Check for existing ACTIVE lock by this user on this schedule
    const existingLock = await PriceLock.findOne({
        userId,
        scheduleId,
        status: "ACTIVE",
    });
    if (existingLock) {
        throw new ApiError(409, "You already have an active price lock on this flight. Complete or wait for it to expire.");
    }

    // 4. Calculate lock fee
    const baseFare = schedule.baseFare;
    const lockFee = calculateLockFee(baseFare, lockDurationId);

    // 5. Compute expiration timestamp
    const expiresAt = new Date(Date.now() + durationConfig.ms);

    // 6. Build the flight snapshot (frozen details)
    const flightSnapshot = {
        airlineName: schedule.flightId?.airlineName || "Unknown Airline",
        flightNumber: schedule.flightNumber,
        source: schedule.routeId
            ? `${schedule.routeId.source?.city} (${schedule.routeId.source?.iataCode})`
            : "Unknown",
        destination: schedule.routeId
            ? `${schedule.routeId.destination?.city} (${schedule.routeId.destination?.iataCode})`
            : "Unknown",
        departureDate: schedule.departureDate,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        cabinClass: "ECONOMY",
    };

    // 7. Create the PriceLock document
    const priceLock = await PriceLock.create({
        userId,
        scheduleId,
        lockedFare: baseFare,
        lockFee,
        protectionLimit: PROTECTION_LIMIT,
        lockDurationId,
        expiresAt,
        status: "ACTIVE",
        flightSnapshot,
        paymentReference: `MOCK-PL-${Date.now()}`,
    });

    // 8. Set a Redis key with TTL for expiry tracking
    const ttlSeconds = Math.ceil(durationConfig.ms / 1000);
    await redis.set(
        `pricelock:${priceLock.priceLockId}`,
        JSON.stringify({ userId: userId.toString(), scheduleId }),
        "EX",
        ttlSeconds
    );

    // 9. Schedule auto-expiration (same pattern as seat blocking)
    setTimeout(async () => {
        try {
            const lock = await PriceLock.findById(priceLock._id);
            if (lock && lock.status === "ACTIVE") {
                lock.status = "EXPIRED";
                await lock.save();
                console.log(`[PriceLock] Auto-expired lock ${lock.priceLockId}`);
            }
        } catch (err) {
            console.error("[PriceLock] Error in auto-expiration job:", err.message);
        }
    }, durationConfig.ms + 5000); // Run slightly after TTL

    return priceLock;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET USER'S PRICE LOCKS
// ─────────────────────────────────────────────────────────────────────────────
export const getUserPriceLocksService = async (userId) => {
    // Auto-expire any locks that are past their expiresAt but still marked ACTIVE
    await PriceLock.updateMany(
        {
            userId,
            status: "ACTIVE",
            expiresAt: { $lt: new Date() },
        },
        {
            $set: { status: "EXPIRED" },
        }
    );

    // Fetch all locks for this user, newest first
    const locks = await PriceLock.find({ userId })
        .sort({ createdAt: -1 })
        .lean();

    // Enrich each lock with current fare comparison
    const enrichedLocks = [];
    for (const lock of locks) {
        let currentFare = lock.lockedFare;
        let fareStatus = "same"; // "increased", "decreased", "same"

        if (lock.status === "ACTIVE") {
            try {
                const schedule = await FlightSchedule.findById(lock.scheduleId).select("baseFare availableSeats status");
                if (schedule) {
                    currentFare = schedule.baseFare;
                    if (currentFare > lock.lockedFare) fareStatus = "increased";
                    else if (currentFare < lock.lockedFare) fareStatus = "decreased";

                    // If flight sold out, refund the lock fee
                    if (schedule.availableSeats === 0 || schedule.status === "CANCELLED") {
                        await PriceLock.findByIdAndUpdate(lock._id, { status: "REFUNDED" });
                        lock.status = "REFUNDED";
                    }
                }
            } catch (err) {
                // Schedule may have been deleted; treat as expired
                console.error(`[PriceLock] Could not fetch schedule for lock ${lock.priceLockId}:`, err.message);
            }
        }

        enrichedLocks.push({
            ...lock,
            currentFare,
            fareStatus,
            // Effective fare = min(lockedFare, currentFare) — user always gets the better deal
            effectiveFare: Math.min(lock.lockedFare, currentFare),
        });
    }

    return enrichedLocks;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET A SINGLE PRICE LOCK BY ID
// ─────────────────────────────────────────────────────────────────────────────
export const getPriceLockByIdService = async (priceLockId, userId) => {
    const lock = await PriceLock.findOne({ priceLockId }).lean();
    if (!lock) throw new ApiError(404, "Price lock not found.");

    // Ownership check
    if (lock.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only view your own price locks.");
    }

    // Auto-expire if past expiresAt
    if (lock.status === "ACTIVE" && new Date(lock.expiresAt) < new Date()) {
        await PriceLock.findByIdAndUpdate(lock._id, { status: "EXPIRED" });
        lock.status = "EXPIRED";
    }

    // Compute current fare for comparison
    let currentFare = lock.lockedFare;
    let fareStatus = "same";
    try {
        const schedule = await FlightSchedule.findById(lock.scheduleId).select("baseFare availableSeats status");
        if (schedule) {
            currentFare = schedule.baseFare;
            if (currentFare > lock.lockedFare) fareStatus = "increased";
            else if (currentFare < lock.lockedFare) fareStatus = "decreased";
        }
    } catch (err) { /* ignore */ }

    return {
        ...lock,
        currentFare,
        fareStatus,
        effectiveFare: Math.min(lock.lockedFare, currentFare),
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE BOOKING WITH LOCKED FARE
// ─────────────────────────────────────────────────────────────────────────────
export const usePriceLockService = async (priceLockId, userId) => {
    const lock = await PriceLock.findOne({ priceLockId });
    if (!lock) throw new ApiError(404, "Price lock not found.");

    if (lock.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only use your own price locks.");
    }

    if (lock.status !== "ACTIVE") {
        throw new ApiError(400, `This price lock is ${lock.status.toLowerCase()}. Only ACTIVE locks can be used.`);
    }

    // Check if expired by time
    if (new Date(lock.expiresAt) < new Date()) {
        lock.status = "EXPIRED";
        await lock.save();
        throw new ApiError(400, "This price lock has expired.");
    }

    // Verify the schedule still exists and has seats
    const schedule = await FlightSchedule.findById(lock.scheduleId).select("baseFare availableSeats status");
    if (!schedule) {
        lock.status = "REFUNDED";
        await lock.save();
        throw new ApiError(404, "The flight schedule no longer exists. Your lock fee will be refunded.");
    }
    if (schedule.status === "CANCELLED") {
        lock.status = "REFUNDED";
        await lock.save();
        throw new ApiError(400, "This flight has been cancelled. Your lock fee will be refunded.");
    }
    if (schedule.availableSeats === 0) {
        lock.status = "REFUNDED";
        await lock.save();
        throw new ApiError(400, "This flight is fully booked. Your lock fee will be refunded.");
    }

    // Mark lock as USED
    lock.status = "USED";
    await lock.save();

    // Clean up Redis key
    await redis.del(`pricelock:${priceLockId}`);

    // Calculate the effective fare (user gets the lower price)
    const currentFare = schedule.baseFare;
    const effectiveFare = Math.min(lock.lockedFare, currentFare);

    return {
        priceLockId: lock.priceLockId,
        scheduleId: lock.scheduleId,
        lockedFare: lock.lockedFare,
        currentFare,
        effectiveFare,
        savedAmount: currentFare > lock.lockedFare ? currentFare - lock.lockedFare : 0,
        flightSnapshot: lock.flightSnapshot,
        message: `Price lock used successfully. Your effective fare is ₹${effectiveFare.toLocaleString("en-IN")}.`,
    };
};
