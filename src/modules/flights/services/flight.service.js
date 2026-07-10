import { Aircraft as Flight } from "../models/aircraft.model.js";
import { FlightRoute } from "../models/flightRoute.model.js";
import { FlightSchedule } from "../models/flightSchedule.model.js";
import { FlightReview } from "../models/flightReview.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import Booking from "../../bookings/models/booking.model.js";
import { bulkUpsertCities } from "../../places/services/city.service.js";
import { bulkUpsertAirports } from "../services/airport.service.js";

export const createFlightService = async (operatorId, payload) => {
  const existingReg = await Flight.findOne({
    registrationNumber: payload.registrationNumber.toUpperCase(),
  });
  if (existingReg) {
    throw new ApiError(
      409,
      "A flight with this registration number already exists.",
    );
  }
  const flight = await Flight.create({
    ...payload,
    operatorId,
    registrationNumber: payload.registrationNumber.toUpperCase(),
  });
  return flight;
};

export const getVendorFlightsService = async (operatorId) => {
  return await Flight.find({
    operatorId,
  }).sort({
    createdAt: -1,
  });
};

export const getFlightByIdService = async (flightId) => {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  return flight;
};

export const updateFlightService = async (flightId, operatorId, updateData) => {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  if (flight.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only update your own flights.");
  }
  if (updateData.registrationNumber) {
    updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
    const dup = await Flight.findOne({
      registrationNumber: updateData.registrationNumber,
      _id: {
        $ne: flightId,
      },
    });
    if (dup)
      throw new ApiError(
        409,
        "Another flight with this registration number already exists.",
      );
  }
  Object.assign(flight, updateData);
  await flight.save();
  return flight;
};

export const deleteFlightService = async (flightId, operatorId) => {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  if (flight.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only delete your own flights.");
  }
  const now = new Date();
  const activeSchedules = await FlightSchedule.countDocuments({
    flightId,
    departureDate: {
      $gte: now,
    },
    status: "SCHEDULED",
  });
  if (activeSchedules > 0) {
    throw new ApiError(
      400,
      `Cannot retire this aircraft. It is currently assigned to ${activeSchedules} active future schedule(s). Please cancel or reassign them first.`,
    );
  }
  flight.status = "RETIRED";
  await flight.save();
  return true;
};

export const createFlightRouteService = async (operatorId, routeData) => {
  const flight = await Flight.findById(routeData.flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  if (flight.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(403, "You can only create routes for your own flights.");
  }
  routeData.stops.sort((a, b) => a.order - b.order);
  const route = await FlightRoute.create(routeData);
  const citiesToUpsert = [
    {
      name: routeData.source.city,
      state: routeData.source.country || "India",
    },
    {
      name: routeData.destination.city,
      state: routeData.destination.country || "India",
    },
    ...routeData.stops.map((stop) => ({
      name: stop.city,
      state: stop.country || "India",
    })),
  ];
  const airportsToUpsert = [
    {
      iataCode: routeData.source.iataCode,
      name: routeData.source.name,
      city: routeData.source.city,
      country: routeData.source.country,
    },
    {
      iataCode: routeData.destination.iataCode,
      name: routeData.destination.name,
      city: routeData.destination.city,
      country: routeData.destination.country,
    },
    ...routeData.stops.map((stop) => ({
      iataCode: stop.iataCode,
      name: stop.name,
      city: stop.city,
      country: stop.country,
    })),
  ];
  bulkUpsertCities(citiesToUpsert).catch((err) =>
    console.error(
      "[FlightService] Failed to auto-register cities for route:",
      err.message,
    ),
  );
  bulkUpsertAirports(airportsToUpsert).catch((err) =>
    console.error(
      "[FlightService] Failed to auto-register airports for route:",
      err.message,
    ),
  );
  return route;
};

export const getRoutesForFlightService = async (flightId) => {
  return await FlightRoute.find({
    flightId,
  }).sort({
    createdAt: -1,
  });
};

export const createFlightScheduleService = async (operatorId, scheduleData) => {
  const {
    routeId,
    flightId,
    departureDate,
    departureTime,
    arrivalTime,
    baseFare,
  } = scheduleData;
  const flight = await Flight.findById(flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  if (flight.operatorId.toString() !== operatorId.toString()) {
    throw new ApiError(
      403,
      "You can only create schedules for your own flights.",
    );
  }
  const route = await FlightRoute.findById(routeId);
  if (!route) throw new ApiError(404, "Route not found.");
  if (route.flightId.toString() !== flightId) {
    throw new ApiError(
      400,
      "This route does not belong to the specified flight.",
    );
  }
  const duplicate = await FlightSchedule.findOne({
    flightId,
    departureDate: new Date(departureDate),
    departureTime,
  });
  if (duplicate) {
    throw new ApiError(
      409,
      "A schedule already exists for this flight on this date and time.",
    );
  }
  const seats = flight.seatLayout.map((seat) => ({
    seatNumber: seat.seatNumber,
    cabinClass: seat.cabinClass,
    seatType: seat.seatType,
    row: seat.row,
    column: seat.column,
    isExtraLegroom: seat.isExtraLegroom,
    fare: seat.fare || baseFare,
    status: "AVAILABLE",
    bookedBy: null,
    passengerName: null,
    passengerAge: null,
    passengerGender: null,
  }));
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
    availableSeats: seats.length,
    seats,
    departureTerminal: scheduleData.departureTerminal || "",
    arrivalTerminal: scheduleData.arrivalTerminal || "",
    mealOptions: scheduleData.mealOptions || [],
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

export const getVendorFlightSchedulesService = async (operatorId) => {
  const schedules = await FlightSchedule.find({
    operatorId,
  })
    .populate({
      path: "flightId",
      select: "airlineName registrationNumber aircraftModel",
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

export const getFlightScheduleByIdService = async (scheduleId) => {
  const schedule = await FlightSchedule.findById(scheduleId)
    .populate({
      path: "flightId",
      select:
        "airlineName registrationNumber aircraftModel aircraftType cabinClasses amenities averageRating photos operatorName totalSeats",
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes",
    })
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
    totalSeats: schedule.seats
      ? schedule.seats.length
      : schedule.flightId?.totalSeats || schedule.availableSeats,
    mealOptions: schedule.mealOptions,
    cancellationPolicy: schedule.cancellationPolicy,
    status: schedule.status,
  };
};

export const getFlightScheduleSeatsService = async (scheduleId) => {
  const schedule = await FlightSchedule.findById(scheduleId)
    .populate({
      path: "flightId",
      select:
        "airlineName aircraftType aircraftModel cabinClasses amenities averageRating photos operatorName totalSeats",
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes",
    });
  if (!schedule) throw new ApiError(404, "Schedule not found.");
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
    totalSeats: schedule.seats.length,
    seats: schedule.seats,
    mealOptions: schedule.mealOptions,
    cancellationPolicy: schedule.cancellationPolicy,
    status: schedule.status,
  };
};

export const searchFlightsService = async (from, to, date, filters = {}) => {
  const fromRegex = new RegExp(`^${from}$`, "i");
  const toRegex = new RegExp(`^${to}$`, "i");
  const routes = await FlightRoute.find({
    status: "ACTIVE",
    $and: [
      {
        $or: [
          {
            "source.iataCode": fromRegex,
          },
          {
            "source.city": fromRegex,
          },
          {
            "stops.iataCode": fromRegex,
          },
          {
            "stops.city": fromRegex,
          },
        ],
      },
      {
        $or: [
          {
            "destination.iataCode": toRegex,
          },
          {
            "destination.city": toRegex,
          },
          {
            "stops.iataCode": toRegex,
          },
          {
            "stops.city": toRegex,
          },
        ],
      },
    ],
  });
  if (routes.length === 0) return [];
  const validRoutes = [];
  for (const route of routes) {
    const fromStop = route.stops.find(
      (s) => fromRegex.test(s.iataCode) || fromRegex.test(s.city),
    );
    const toStop = route.stops.find(
      (s) => toRegex.test(s.iataCode) || toRegex.test(s.city),
    );
    if (fromStop && toStop && fromStop.order < toStop.order) {
      validRoutes.push({
        routeId: route._id,
        boardingStop: fromStop,
        droppingStop: toStop,
      });
    }
  }
  if (validRoutes.length === 0) return [];
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
    status: {
      $in: ["SCHEDULED", "DELAYED", "BOARDING"],
    },
    availableSeats: {
      $gt: 0,
    },
  };
  const flightQuery = {};
  if (filters.aircraftType) flightQuery.aircraftType = filters.aircraftType;
  if (filters.cabinClass) {
    flightQuery.cabinClasses = {
      $in: [filters.cabinClass.toUpperCase()],
    };
  }
  let schedules = await FlightSchedule.find(scheduleQuery)
    .populate({
      path: "flightId",
      select:
        "airlineName aircraftType aircraftModel cabinClasses amenities averageRating totalRatings photos operatorName totalSeats",
      match: Object.keys(flightQuery).length > 0 ? flightQuery : undefined,
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes",
    })
    .select("-seats")
    .sort({
      departureTime: 1,
    });
  schedules = schedules.filter((s) => s.flightId !== null);
  const routeMap = new Map(validRoutes.map((r) => [r.routeId.toString(), r]));
  schedules = schedules.map((schedule) => {
    const s = schedule.toObject();
    const routeInfo = routeMap.get(schedule.routeId._id.toString());
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
  if (filters.minPrice) {
    schedules = schedules.filter(
      (s) => s.pricing.baseFare >= Number(filters.minPrice),
    );
  }
  if (filters.maxPrice) {
    schedules = schedules.filter(
      (s) => s.pricing.baseFare <= Number(filters.maxPrice),
    );
  }
  if (filters.sortBy === "price_low") {
    schedules.sort((a, b) => a.pricing.baseFare - b.pricing.baseFare);
  } else if (filters.sortBy === "price_high") {
    schedules.sort((a, b) => b.pricing.baseFare - a.pricing.baseFare);
  } else if (filters.sortBy === "rating") {
    schedules.sort((a, b) => b.flight.rating - a.flight.rating);
  } else if (filters.sortBy === "duration") {
    schedules.sort(
      (a, b) =>
        (a.journey.durationMinutes || 0) - (b.journey.durationMinutes || 0),
    );
  } else if (filters.sortBy === "departure") {
    schedules.sort((a, b) =>
      a.journey.departureTime.localeCompare(b.journey.departureTime),
    );
  }
  return schedules;
};

export const blockSeatsService = async (userId, scheduleId, seatNumbers) => {
  const schedule = await FlightSchedule.findById(scheduleId);
  if (!schedule) throw new ApiError(404, "Schedule not found.");
  const validSeats = [];
  for (const seatNumber of seatNumbers) {
    const seat = schedule.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat) {
      throw new ApiError(
        400,
        `Seat ${seatNumber} does not exist on this flight.`,
      );
    }
    if (seat.status === "BOOKED") {
      throw new ApiError(409, `Seat ${seatNumber} is already booked.`);
    }
    const lockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
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
    const seatLockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
    pipeline.set(seatLockKey, userId.toString(), "EX", TTL_SECONDS);
    const seatIndex = schedule.seats.findIndex(
      (s) => s.seatNumber === seatNumber,
    );
    if (seatIndex !== -1) {
      schedule.seats[seatIndex].status = "BLOCKED";
    }
  }
  const userLockKey = `flight_lock:${scheduleId}:${userId}`;
  pipeline.set(userLockKey, JSON.stringify(validSeats), "EX", TTL_SECONDS);
  await pipeline.exec();
  await schedule.save();
  setTimeout(
    async () => {
      try {
        const sched = await FlightSchedule.findById(scheduleId);
        if (!sched) return;
        let changed = false;
        for (const seatNumber of validSeats) {
          const lockKey = `flight_seat_lock:${scheduleId}:${seatNumber}`;
          const lockValue = await redis.get(lockKey);
          if (!lockValue) {
            const idx = sched.seats.findIndex(
              (s) => s.seatNumber === seatNumber,
            );
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
    },
    (TTL_SECONDS + 5) * 1000,
  );
  return {
    message: "Seats blocked successfully for 10 minutes.",
    expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
  };
};

export const cancelFlightScheduleService = async (operatorId, scheduleId) => {
  const schedule = await FlightSchedule.findById(scheduleId);
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
  if (schedule.status === "DEPARTED") {
    throw new ApiError(
      400,
      "Cannot cancel a flight that has already departed.",
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

export const addFlightReviewService = async (
  userId,
  flightId,
  bookingId,
  rating,
  reviewText,
) => {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new ApiError(404, "Flight not found.");
  const existing = await FlightReview.findOne({
    bookingId,
  });
  if (existing)
    throw new ApiError(409, "You have already reviewed this flight.");
  const review = await FlightReview.create({
    userId,
    flightId,
    bookingId,
    rating,
    review: reviewText,
  });
  const stats = await FlightReview.aggregate([
    {
      $match: {
        flightId: flight._id,
      },
    },
    {
      $group: {
        _id: "$flightId",
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
    flight.averageRating = Math.round(stats[0].avgRating * 10) / 10;
    flight.totalRatings = stats[0].totalRatings;
    await flight.save();
  }
  return review;
};

export const createFlightBookingService = async (userId, payload) => {
  const { scheduleId, passengerDetails } = payload;
  const schedule = await FlightSchedule.findById(scheduleId)
    .populate({
      path: "routeId",
      select: "source destination stops",
    })
    .populate({
      path: "flightId",
      select: "airlineName flightNumber aircraftType",
    });
  if (!schedule) {
    throw new ApiError(404, "Flight schedule not found.");
  }
  const lockKey = `flight_lock:${scheduleId}:${userId}`;
  const lockExists = await redis.exists(lockKey);
  if (!lockExists) {
    throw new ApiError(
      400,
      "No active seat lock found. Please select seats again.",
    );
  }
  const lockedSeatsJson = await redis.get(lockKey);
  const lockedSeats = lockedSeatsJson ? JSON.parse(lockedSeatsJson) : [];
  for (const passenger of passengerDetails) {
    if (!lockedSeats.includes(passenger.seatNumber)) {
      throw new ApiError(
        400,
        `Seat ${passenger.seatNumber} is not locked. Please select seats again.`,
      );
    }
  }
  const totalFare = passengerDetails.reduce((sum, p) => {
    const seat = schedule.seats.find((s) => s.seatNumber === p.seatNumber);
    if (!seat)
      throw new ApiError(400, `Seat ${p.seatNumber} not found in schedule.`);
    return sum + (seat.fare || schedule.baseFare);
  }, 0);
  const route = schedule.routeId;
  const sourceAirport = route?.source || {};
  const destAirport = route?.destination || {};
  const booking = await Booking.create({
    bookingId: `FLY-${Date.now().toString(36).toUpperCase()}`,
    userId,
    scheduleId,
    busId: schedule.flightId,
    operatorId: schedule.operatorId,
    routeId: schedule.routeId?._id || schedule.routeId,
    boardingPoint: {
      name: schedule.departureTerminal || sourceAirport.name || "Airport",
      city: sourceAirport.city || "",
      time: schedule.departureTime,
      iata: sourceAirport.iataCode || "",
    },
    droppingPoint: {
      name: schedule.arrivalTerminal || destAirport.name || "Airport",
      city: destAirport.city || "",
      time: schedule.arrivalTime,
      iata: destAirport.iataCode || "",
    },
    passengerDetails,
    bookedSeats: passengerDetails.map((p) => p.seatNumber),
    totalFare,
    bookingStatus: "PENDING",
    paymentStatus: "PENDING",
    bookedAt: new Date(),
    travelDate: schedule.departureDate,
  });
  for (const passenger of passengerDetails) {
    const seatIndex = schedule.seats.findIndex(
      (s) => s.seatNumber === passenger.seatNumber,
    );
    if (seatIndex !== -1) {
      schedule.seats[seatIndex].status = "BOOKED";
      schedule.seats[seatIndex].passengerName = passenger.name;
      schedule.seats[seatIndex].passengerGender =
        passenger.gender === "male"
          ? "M"
          : passenger.gender === "female"
            ? "F"
            : "O";
    }
  }
  schedule.availableSeats = Math.max(
    0,
    schedule.availableSeats - passengerDetails.length,
  );
  await schedule.save();
  await redis.del(lockKey);
  return booking;
};
