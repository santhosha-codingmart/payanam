import PriceLock from "../models/priceLock.model.js";
import { FlightSchedule } from "../models/flightSchedule.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";

const LOCK_DURATIONS = {
  "4h": {
    label: "4 hours",
    ms: 4 * 60 * 60 * 1000,
    pct: 0.015,
    minFee: 99,
  },
  "8h": {
    label: "8 hours",
    ms: 8 * 60 * 60 * 1000,
    pct: 0.02,
    minFee: 149,
  },
  "12h": {
    label: "12 hours",
    ms: 12 * 60 * 60 * 1000,
    pct: 0.025,
    minFee: 199,
  },
  "1d": {
    label: "1 day",
    ms: 24 * 60 * 60 * 1000,
    pct: 0.03,
    minFee: 299,
  },
  "3d": {
    label: "3 days",
    ms: 3 * 24 * 60 * 60 * 1000,
    pct: 0.04,
    minFee: 499,
  },
  "7d": {
    label: "7 days",
    ms: 7 * 24 * 60 * 60 * 1000,
    pct: 0.055,
    minFee: 799,
  },
};
const PROTECTION_LIMIT = 7500;

export const calculateLockFee = (baseFare, lockDurationId) => {
  const config = LOCK_DURATIONS[lockDurationId];
  if (!config)
    throw new ApiError(400, `Invalid lock duration: ${lockDurationId}`);
  return Math.max(config.minFee, Math.round(baseFare * config.pct));
};

export const getLockOptionsForFare = (baseFare) => {
  return Object.entries(LOCK_DURATIONS).map(([id, config]) => ({
    id,
    duration: config.label,
    fee: Math.max(config.minFee, Math.round(baseFare * config.pct)),
    flightPrice: baseFare,
  }));
};

export const createPriceLockService = async (
  userId,
  scheduleId,
  lockDurationId,
) => {
  const durationConfig = LOCK_DURATIONS[lockDurationId];
  if (!durationConfig) {
    throw new ApiError(
      400,
      `Invalid lock duration: ${lockDurationId}. Valid options: ${Object.keys(LOCK_DURATIONS).join(", ")}`,
    );
  }
  const schedule = await FlightSchedule.findById(scheduleId)
    .populate({
      path: "flightId",
      select: "airlineName",
    })
    .populate({
      path: "routeId",
      select: "source destination",
    });
  if (!schedule) throw new ApiError(404, "Flight schedule not found.");
  if (schedule.status === "CANCELLED")
    throw new ApiError(400, "Cannot lock price for a cancelled flight.");
  if (schedule.status === "COMPLETED")
    throw new ApiError(400, "Cannot lock price for a completed flight.");
  if (schedule.status === "DEPARTED")
    throw new ApiError(400, "Cannot lock price for a departed flight.");
  const existingLock = await PriceLock.findOne({
    userId,
    scheduleId,
    status: "ACTIVE",
  });
  if (existingLock) {
    throw new ApiError(
      409,
      "You already have an active price lock on this flight. Complete or wait for it to expire.",
    );
  }
  const baseFare = schedule.baseFare;
  const lockFee = calculateLockFee(baseFare, lockDurationId);
  const expiresAt = new Date(Date.now() + durationConfig.ms);
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
  const ttlSeconds = Math.ceil(durationConfig.ms / 1000);
  await redis.set(
    `pricelock:${priceLock.priceLockId}`,
    JSON.stringify({
      userId: userId.toString(),
      scheduleId,
    }),
    "EX",
    ttlSeconds,
  );
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
  }, durationConfig.ms + 5000);
  return priceLock;
};

export const getUserPriceLocksService = async (userId) => {
  await PriceLock.updateMany(
    {
      userId,
      status: "ACTIVE",
      expiresAt: {
        $lt: new Date(),
      },
    },
    {
      $set: {
        status: "EXPIRED",
      },
    },
  );
  const locks = await PriceLock.find({
    userId,
  })
    .sort({
      createdAt: -1,
    })
    .lean();
  const enrichedLocks = [];
  for (const lock of locks) {
    let currentFare = lock.lockedFare;
    let fareStatus = "same";
    if (lock.status === "ACTIVE") {
      try {
        const schedule = await FlightSchedule.findById(lock.scheduleId).select(
          "baseFare availableSeats status",
        );
        if (schedule) {
          currentFare = schedule.baseFare;
          if (currentFare > lock.lockedFare) fareStatus = "increased";
          else if (currentFare < lock.lockedFare) fareStatus = "decreased";
          if (
            schedule.availableSeats === 0 ||
            schedule.status === "CANCELLED"
          ) {
            await PriceLock.findByIdAndUpdate(lock._id, {
              status: "REFUNDED",
            });
            lock.status = "REFUNDED";
          }
        }
      } catch (err) {
        console.error(
          `[PriceLock] Could not fetch schedule for lock ${lock.priceLockId}:`,
          err.message,
        );
      }
    }
    enrichedLocks.push({
      ...lock,
      currentFare,
      fareStatus,
      effectiveFare: Math.min(lock.lockedFare, currentFare),
    });
  }
  return enrichedLocks;
};

export const getPriceLockByIdService = async (priceLockId, userId) => {
  const lock = await PriceLock.findOne({
    priceLockId,
  }).lean();
  if (!lock) throw new ApiError(404, "Price lock not found.");
  if (lock.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only view your own price locks.");
  }
  if (lock.status === "ACTIVE" && new Date(lock.expiresAt) < new Date()) {
    await PriceLock.findByIdAndUpdate(lock._id, {
      status: "EXPIRED",
    });
    lock.status = "EXPIRED";
  }
  let currentFare = lock.lockedFare;
  let fareStatus = "same";
  try {
    const schedule = await FlightSchedule.findById(lock.scheduleId).select(
      "baseFare availableSeats status",
    );
    if (schedule) {
      currentFare = schedule.baseFare;
      if (currentFare > lock.lockedFare) fareStatus = "increased";
      else if (currentFare < lock.lockedFare) fareStatus = "decreased";
    }
  } catch (err) {}
  return {
    ...lock,
    currentFare,
    fareStatus,
    effectiveFare: Math.min(lock.lockedFare, currentFare),
  };
};

export const usePriceLockService = async (priceLockId, userId) => {
  const lock = await PriceLock.findOne({
    priceLockId,
  });
  if (!lock) throw new ApiError(404, "Price lock not found.");
  if (lock.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only use your own price locks.");
  }
  if (lock.status !== "ACTIVE") {
    throw new ApiError(
      400,
      `This price lock is ${lock.status.toLowerCase()}. Only ACTIVE locks can be used.`,
    );
  }
  if (new Date(lock.expiresAt) < new Date()) {
    lock.status = "EXPIRED";
    await lock.save();
    throw new ApiError(400, "This price lock has expired.");
  }
  const schedule = await FlightSchedule.findById(lock.scheduleId).select(
    "baseFare availableSeats status",
  );
  if (!schedule) {
    lock.status = "REFUNDED";
    await lock.save();
    throw new ApiError(
      404,
      "The flight schedule no longer exists. Your lock fee will be refunded.",
    );
  }
  if (schedule.status === "CANCELLED") {
    lock.status = "REFUNDED";
    await lock.save();
    throw new ApiError(
      400,
      "This flight has been cancelled. Your lock fee will be refunded.",
    );
  }
  if (schedule.availableSeats === 0) {
    lock.status = "REFUNDED";
    await lock.save();
    throw new ApiError(
      400,
      "This flight is fully booked. Your lock fee will be refunded.",
    );
  }
  lock.status = "USED";
  await lock.save();
  await redis.del(`pricelock:${priceLockId}`);
  const currentFare = schedule.baseFare;
  const effectiveFare = Math.min(lock.lockedFare, currentFare);
  return {
    priceLockId: lock.priceLockId,
    scheduleId: lock.scheduleId,
    lockedFare: lock.lockedFare,
    currentFare,
    effectiveFare,
    savedAmount:
      currentFare > lock.lockedFare ? currentFare - lock.lockedFare : 0,
    flightSnapshot: lock.flightSnapshot,
    message: `Price lock used successfully. Your effective fare is ₹${effectiveFare.toLocaleString("en-IN")}.`,
  };
};
