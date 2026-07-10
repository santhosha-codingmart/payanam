import { Bus } from "../models/bus.model.js";
import { Route } from "../models/route.model.js";
import { Schedule } from "../models/schedule.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import { Review } from "../models/review.model.js";
import Booking from "../../bookings/models/booking.model.js";
import { bulkUpsertCities } from "../../places/services/city.service.js";

export const createBusService = async (operatorId, payload) => {
  const existing = await Bus.findOne({
    registrationNumber: payload.registrationNumber.toUpperCase(),
  });
  if (existing) {
    throw new ApiError(
      409,
      "A bus with this registration number already exists.",
    );
  }
  const existingBusNum = await Bus.findOne({
    busNumber: payload.busNumber.toUpperCase(),
  });
  if (existingBusNum) {
    throw new ApiError(409, "A bus with this bus number already exists.");
  }
  const bus = await Bus.create({
    ...payload,
    operatorId,
    registrationNumber: payload.registrationNumber.toUpperCase(),
    busNumber: payload.busNumber.toUpperCase(),
  });
  return bus;
};

export const getVendorBusesService = async (operatorId, filters = {}) => {
  const { search, busType, from, to } = filters;
  const query = {
    operatorId,
  };
  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [
      {
        registrationNumber: searchRegex,
      },
      {
        busNumber: searchRegex,
      },
      {
        busName: searchRegex,
      },
    ];
  }
  if (busType) {
    query.busType = busType;
  }
  if (from || to) {
    const routeQuery = {
      status: "ACTIVE",
    };
    if (from && to) {
      const fromRegex = new RegExp(`^${from}$`, "i");
      const toRegex = new RegExp(`^${to}$`, "i");
      routeQuery.$and = [
        {
          $or: [
            {
              "source.city": fromRegex,
            },
            {
              "stops.city": fromRegex,
            },
          ],
        },
        {
          $or: [
            {
              "destination.city": toRegex,
            },
            {
              "stops.city": toRegex,
            },
          ],
        },
      ];
    } else if (from) {
      const fromRegex = new RegExp(`^${from}$`, "i");
      routeQuery.$or = [
        {
          "source.city": fromRegex,
        },
        {
          "stops.city": fromRegex,
        },
      ];
    } else if (to) {
      const toRegex = new RegExp(`^${to}$`, "i");
      routeQuery.$or = [
        {
          "destination.city": toRegex,
        },
        {
          "stops.city": toRegex,
        },
      ];
    }
    const matchingRoutes = await Route.find(routeQuery).select("busId stops");
    const validBusIds = new Set();
    if (from && to) {
      const fromRegex = new RegExp(`^${from}$`, "i");
      const toRegex = new RegExp(`^${to}$`, "i");
      for (const route of matchingRoutes) {
        const fromStop = route.stops.find((s) => fromRegex.test(s.city));
        const toStop = route.stops.find((s) => toRegex.test(s.city));
        if (fromStop && toStop && fromStop.order < toStop.order) {
          validBusIds.add(route.busId.toString());
        }
      }
    } else {
      for (const route of matchingRoutes) {
        validBusIds.add(route.busId.toString());
      }
    }
    query._id = {
      $in: Array.from(validBusIds),
    };
  }
  return await Bus.find(query).sort({
    createdAt: -1,
  });
};

export const getBusByIdService = async (busId) => {
  const bus = await Bus.findById(busId);
  if (!bus) {
    throw new ApiError(404, "Bus not found.");
  }
  return bus;
};

export const updateBusService = async (busId, operatorId, updateData) => {
  const bus = await Bus.findById(busId);
  if (!bus) {
    throw new ApiError(404, "Bus not found.");
  }
  if (bus.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only update your own buses.");
  }
  if (updateData.registrationNumber) {
    updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
    const duplicate = await Bus.findOne({
      registrationNumber: updateData.registrationNumber,
      _id: {
        $ne: busId,
      },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        "Another bus with this registration number already exists.",
      );
    }
  }
  if (updateData.busNumber) {
    updateData.busNumber = updateData.busNumber.toUpperCase();
    const duplicate = await Bus.findOne({
      busNumber: updateData.busNumber,
      _id: {
        $ne: busId,
      },
    });
    if (duplicate) {
      throw new ApiError(
        409,
        "Another bus with this bus number already exists.",
      );
    }
  }
  Object.assign(bus, updateData);
  await bus.save();
  return bus;
};

export const deleteBusService = async (busId, operatorId) => {
  const bus = await Bus.findById(busId);
  if (!bus) {
    throw new ApiError(404, "Bus not found.");
  }
  if (bus.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only delete your own buses.");
  }
  const now = new Date();
  const activeSchedules = await Schedule.countDocuments({
    busId,
    departureDate: {
      $gte: now,
    },
    status: "SCHEDULED",
  });
  if (activeSchedules > 0) {
    throw new ApiError(
      400,
      `Cannot retire this bus. It is currently assigned to ${activeSchedules} active future schedule(s). Please cancel or reassign them first.`,
    );
  }
  bus.status = "RETIRED";
  await bus.save();
  return true;
};

export const createRouteService = async (operatorId, routeData) => {
  const bus = await Bus.findById(routeData.busId);
  if (!bus) {
    throw new ApiError(404, "Bus not found.");
  }
  if (bus.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only create routes for your own buses.");
  }
  routeData.stops.sort((a, b) => a.order - b.order);
  const route = await Route.create(routeData);
  const citiesToUpsert = [
    {
      name: routeData.source.city,
      state: routeData.source.state,
    },
    {
      name: routeData.destination.city,
      state: routeData.destination.state,
    },
    ...routeData.stops.map((stop) => ({
      name: stop.city,
      state: stop.state || routeData.source.state,
    })),
  ];
  bulkUpsertCities(citiesToUpsert).catch((err) =>
    console.error(
      "[CityService] Failed to auto-register cities for route:",
      err.message,
    ),
  );
  return route;
};

export const getRoutesForBusService = async (busId) => {
  return await Route.find({
    busId,
  }).sort({
    createdAt: -1,
  });
};

export const createScheduleService = async (operatorId, scheduleData) => {
  const {
    routeId,
    busId,
    departureDate,
    arrivalDate,
    departureTime,
    arrivalTime,
    baseFare,
  } = scheduleData;
  const bus = await Bus.findById(busId);
  if (!bus) {
    throw new ApiError(404, "Bus not found.");
  }
  if (bus.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(
      403,
      "You can only create schedules for your own buses.",
    );
  }
  const route = await Route.findById(routeId);
  if (!route) {
    throw new ApiError(404, "Route not found.");
  }
  if (route.busId.toString() !== busId) {
    throw new ApiError(400, "This route does not belong to the specified bus.");
  }
  const departureDateObj = new Date(departureDate);
  if (isNaN(departureDateObj.getTime())) {
    throw new ApiError(400, "Invalid departure date format");
  }
  const arrivalDateObj = arrivalDate ? new Date(arrivalDate) : departureDateObj;
  if (isNaN(arrivalDateObj.getTime())) {
    throw new ApiError(400, "Invalid arrival date format");
  }
  const duplicate = await Schedule.findOne({
    busId,
    departureDate: departureDateObj,
    departureTime,
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "A schedule already exists for this bus on this date and time.",
    );
  }
  const seats = bus.seatLayout.map((seat) => ({
    seatNumber: seat.seatNumber,
    seatType: seat.seatType,
    deck: seat.deck,
    row: seat.row,
    column: seat.column,
    isSleeper: seat.isSleeper,
    fare: seat.fare || baseFare,
    status: "AVAILABLE",
    bookedBy: null,
    passengerName: null,
    passengerAge: null,
    passengerGender: null,
  }));
  const schedule = await Schedule.create({
    routeId,
    busId,
    operatorId,
    departureDate: departureDateObj,
    arrivalDate: arrivalDateObj,
    departureTime,
    arrivalTime,
    baseFare,
    availableSeats: seats.length,
    seats,
    boardingPoints: scheduleData.boardingPoints || [],
    droppingPoints: scheduleData.droppingPoints || [],
    cancellationPolicy: scheduleData.cancellationPolicy || [
      {
        hoursBeforeDeparture: 24,
        refundPercentage: 75,
      },
      {
        hoursBeforeDeparture: 12,
        refundPercentage: 50,
      },
      {
        hoursBeforeDeparture: 6,
        refundPercentage: 25,
      },
      {
        hoursBeforeDeparture: 0,
        refundPercentage: 0,
      },
    ],
  });
  return schedule;
};

export const getScheduleSeatsService = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId)
    .populate({
      path: "busId",
      select:
        "busName busType busNumber amenities seatLayoutType photos averageRating",
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes",
    });
  if (!schedule) {
    throw new ApiError(404, "Schedule not found.");
  }
  return {
    scheduleId: schedule._id,
    bus: schedule.busId,
    route: schedule.routeId,
    departureDate: schedule.departureDate,
    arrivalDate: schedule.arrivalDate,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    baseFare: schedule.baseFare,
    availableSeats: schedule.availableSeats,
    totalSeats: schedule.seats.length,
    seats: schedule.seats,
    boardingPoints: schedule.boardingPoints,
    droppingPoints: schedule.droppingPoints,
    cancellationPolicy: schedule.cancellationPolicy,
    status: schedule.status,
  };
};

export const getVendorSchedulesService = async (operatorId) => {
  const schedules = await Schedule.find({
    operatorId,
  })
    .populate({
      path: "busId",
      select: "busName busNumber busType",
    })
    .populate({
      path: "routeId",
      select: "source destination",
    })
    .select("-seats")
    .sort({
      departureDate: 1,
      departureTime: 1,
    });
  return schedules;
};

export const getScheduleByIdService = async (scheduleId) => {
  const schedule = await Schedule.findById(scheduleId)
    .populate({
      path: "busId",
      select:
        "busName busNumber busType totalSeats amenities isAC isSleeper isSeater photos averageRating operatorName",
    })
    .populate({
      path: "routeId",
      select:
        "source destination distanceInKm estimatedDurationInMinutes boardingPoints droppingPoints farePerKm",
    })
    .select("-seats");
  if (!schedule) throw new ApiError(404, "Schedule not found");
  return {
    scheduleId: schedule._id,
    bus: schedule.busId,
    route: schedule.routeId,
    departureDate: schedule.departureDate,
    arrivalDate: schedule.arrivalDate,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    baseFare: schedule.baseFare,
    availableSeats: schedule.availableSeats,
    totalSeats: schedule.seats
      ? schedule.seats.length
      : schedule.busId?.totalSeats || schedule.availableSeats,
    boardingPoints: schedule.boardingPoints,
    droppingPoints: schedule.droppingPoints,
    cancellationPolicy: schedule.cancellationPolicy,
    status: schedule.status,
  };
};

export const searchBusesService = async (from, to, date, filters = {}) => {
  const fromRegex = new RegExp(`^${from}$`, "i");
  const toRegex = new RegExp(`^${to}$`, "i");
  const routes = await Route.find({
    status: "ACTIVE",
    $and: [
      {
        $or: [
          {
            "source.city": fromRegex,
          },
          {
            "stops.city": fromRegex,
          },
        ],
      },
      {
        $or: [
          {
            "destination.city": toRegex,
          },
          {
            "stops.city": toRegex,
          },
        ],
      },
    ],
  });
  if (routes.length === 0) {
    return [];
  }
  const validRoutes = [];
  for (const route of routes) {
    const fromStop = route.stops.find((s) => fromRegex.test(s.city));
    const toStop = route.stops.find((s) => toRegex.test(s.city));
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
  const routeIds = validRoutes.map((r) => r.routeId);
  const searchDate = new Date(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  const scheduleQuery = {
    routeId: {
      $in: routeIds,
    },
    departureDate: {
      $gte: searchDate,
      $lt: nextDay,
    },
    status: "SCHEDULED",
    availableSeats: {
      $gt: 0,
    },
  };
  const busQuery = {};
  if (filters.busType) {
    busQuery.busType = filters.busType;
  }
  if (filters.isAC !== undefined) {
    busQuery.isAC = filters.isAC === "true";
  }
  let query = Schedule.find(scheduleQuery)
    .populate({
      path: "busId",
      select:
        "busName busType busNumber amenities seatLayoutType isAC isSleeper isSeater averageRating totalRatings photos operatorName totalSeats",
      match: Object.keys(busQuery).length > 0 ? busQuery : undefined,
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes farePerKm",
    })
    .select("-seats")
    .sort({
      departureTime: 1,
    });
  let schedules = await query;
  schedules = schedules.filter((s) => s.busId !== null);
  const routeMap = new Map(validRoutes.map((r) => [r.routeId.toString(), r]));
  schedules = schedules.map((schedule) => {
    const scheduleObj = schedule.toObject();
    const routeInfo = routeMap.get(schedule.routeId._id.toString());
    let calculatedFare = scheduleObj.baseFare;
    if (routeInfo) {
      const segmentDistance =
        routeInfo.droppingStop.distanceFromSource -
        routeInfo.boardingStop.distanceFromSource;
      if (routeInfo.farePerKm > 0 && segmentDistance > 0) {
        calculatedFare = Math.round(routeInfo.farePerKm * segmentDistance);
      }
    }
    const filteredBoardingPoints = (scheduleObj.boardingPoints || [])
      .filter((bp) => fromRegex.test(bp.city))
      .map((bp) => ({
        id: bp._id,
        city: bp.city,
        name: bp.name,
        time: bp.time,
        address: bp.address,
        landmark: bp.landmark,
      }));
    const filteredDroppingPoints = (scheduleObj.droppingPoints || [])
      .filter((dp) => toRegex.test(dp.city))
      .map((dp) => ({
        id: dp._id,
        city: dp.city,
        name: dp.name,
        time: dp.time,
        address: dp.address,
        landmark: dp.landmark,
      }));
    const cancellationPolicy = (scheduleObj.cancellationPolicy || []).map(
      (cp) => ({
        hoursBeforeDeparture: cp.hoursBeforeDeparture,
        refundPercentage: cp.refundPercentage,
      }),
    );
    return {
      scheduleId: scheduleObj._id,
      operator: {
        id: scheduleObj.operatorId,
        name: scheduleObj.busId?.operatorName || "Unknown",
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
        rating: scheduleObj.busId?.averageRating || 0,
      },
      journey: {
        departureDate: scheduleObj.departureDate,
        arrivalDate: scheduleObj.arrivalDate,
        departureTime: scheduleObj.departureTime,
        arrivalTime: scheduleObj.arrivalTime,
        durationMinutes: scheduleObj.routeId?.estimatedDurationInMinutes,
        source: routeInfo
          ? routeInfo.boardingStop.city
          : scheduleObj.routeId?.source.city,
        destination: routeInfo
          ? routeInfo.droppingStop.city
          : scheduleObj.routeId?.destination.city,
      },
      pricing: {
        baseFare: scheduleObj.baseFare,
        calculatedFare: calculatedFare,
      },
      seats: {
        available: scheduleObj.availableSeats,
        total: scheduleObj.busId?.totalSeats || scheduleObj.availableSeats,
      },
      boardingPoints: filteredBoardingPoints,
      droppingPoints: filteredDroppingPoints,
      cancellationPolicy: cancellationPolicy,
      status: scheduleObj.status,
    };
  });
  if (filters.minPrice) {
    schedules = schedules.filter(
      (s) => s.pricing.calculatedFare >= Number(filters.minPrice),
    );
  }
  if (filters.maxPrice) {
    schedules = schedules.filter(
      (s) => s.pricing.calculatedFare <= Number(filters.maxPrice),
    );
  }
  if (filters.sortBy === "price_low") {
    schedules.sort(
      (a, b) => a.pricing.calculatedFare - b.pricing.calculatedFare,
    );
  } else if (filters.sortBy === "price_high") {
    schedules.sort(
      (a, b) => b.pricing.calculatedFare - a.pricing.calculatedFare,
    );
  } else if (filters.sortBy === "rating") {
    schedules.sort((a, b) => b.bus.rating - a.bus.rating);
  } else if (filters.sortBy === "departure") {
    schedules.sort((a, b) =>
      a.journey.departureTime.localeCompare(b.journey.departureTime),
    );
  }
  return schedules;
};

export const blockSeatsService = async (userId, scheduleId, seatNumbers) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new ApiError(404, "Schedule not found");
  }
  const validSeats = [];
  for (const seatNumber of seatNumbers) {
    const seat = schedule.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) {
      throw new ApiError(400, `Seat ${seatNumber} does not exist on this bus.`);
    }
    if (seat.status === "BOOKED") {
      throw new ApiError(409, `Seat ${seatNumber} is already booked.`);
    }
    const lockKey = `seat_lock:${scheduleId}:${seatNumber}`;
    const existingLock = await redis.get(lockKey);
    if (existingLock && existingLock !== userId.toString()) {
      throw new ApiError(
        409,
        `Seat ${seatNumber} is currently being booked by another user. Please try again later.`,
      );
    }
    validSeats.push(seatNumber);
  }
  const TTL_SECONDS = 600;
  const pipeline = redis.pipeline();
  for (const seatNumber of validSeats) {
    const lockKey = `seat_lock:${scheduleId}:${seatNumber}`;
    pipeline.set(lockKey, userId.toString(), "EX", TTL_SECONDS);
    const seatIndex = schedule.seats.findIndex(
      (s) => s.seatNumber === seatNumber,
    );
    if (seatIndex !== -1) {
      schedule.seats[seatIndex].status = "BLOCKED";
    }
  }
  await pipeline.exec();
  await schedule.save();
  setTimeout(
    async () => {
      try {
        const sched = await Schedule.findById(scheduleId);
        if (!sched) return;
        let changed = false;
        for (const seatNumber of validSeats) {
          const lockKey = `seat_lock:${scheduleId}:${seatNumber}`;
          const lockValue = await redis.get(lockKey);
          if (!lockValue) {
            const seatIndex = sched.seats.findIndex(
              (s) => s.seatNumber === seatNumber,
            );
            if (
              seatIndex !== -1 &&
              sched.seats[seatIndex].status === "BLOCKED"
            ) {
              sched.seats[seatIndex].status = "AVAILABLE";
              changed = true;
            }
          }
        }
        if (changed) await sched.save();
      } catch (error) {
        console.error("Error in seat unblocking job:", error);
      }
    },
    (TTL_SECONDS + 5) * 1000,
  );
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  return {
    message: "Seats blocked successfully for 10 minutes.",
    expiresAt,
  };
};

export const cancelScheduleService = async (operatorId, scheduleId) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw new ApiError(404, "Schedule not found.");
  if (schedule.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only cancel your own schedules.");
  }
  if (schedule.status === "CANCELLED") {
    throw new ApiError(409, "This schedule is already cancelled.");
  }
  if (schedule.status === "COMPLETED") {
    throw new ApiError(400, "A completed schedule cannot be cancelled.");
  }
  if (schedule.status === "IN_TRANSIT") {
    throw new ApiError(
      400,
      "Cannot cancel a schedule that is currently in transit.",
    );
  }
  const affectedBookings = await Booking.find({
    scheduleId,
    bookingStatus: "CONFIRMED",
  });
  const cancelledCount = affectedBookings.length;
  for (const booking of affectedBookings) {
    booking.bookingStatus = "CANCELLED";
    booking.paymentStatus = "REFUNDED";
    booking.refundAmount = booking.totalFare;
    booking.cancelledAt = new Date();
    await booking.save();
  }
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

export const addReviewService = async (
  userId,
  busId,
  bookingId,
  rating,
  reviewText,
) => {
  const bus = await Bus.findById(busId);
  if (!bus) throw new ApiError(404, "Bus not found");
  const existingReview = await Review.findOne({
    bookingId,
  });
  if (existingReview) {
    throw new ApiError(409, "You have already reviewed this trip.");
  }
  const review = await Review.create({
    userId,
    busId,
    bookingId,
    rating,
    review: reviewText,
  });
  const stats = await Review.aggregate([
    {
      $match: {
        busId: bus._id,
      },
    },
    {
      $group: {
        _id: "$busId",
        avgRating: {
          $avg: "$rating",
        },
        totalRatings: {
          $sum: 1,
        },
      },
    },
  ]);
  if (stats.length > 0) {
    bus.averageRating = Math.round(stats[0].avgRating * 10) / 10;
    bus.totalRatings = stats[0].totalRatings;
    await bus.save();
  }
  return review;
};
