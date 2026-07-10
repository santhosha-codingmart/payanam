import mongoose from "mongoose";
import Booking from "../models/booking.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import { Bus } from "../../bus/models/bus.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import { initiateRefund } from "../../payments/services/payment.service.js";
import { sendBookingCancellationEmail } from "../../../utils/email.service.js";
import User from "../../users/models/user.model.js";
import { generateTicketPDF } from "../../../utils/ticket.pdf.service.js";
import logger from "../../../config/logger.js";

const getAdjacentColumnPairs = (layoutType) => {
  switch (layoutType) {
    case "2+2_SEATER":
      return [
        [1, 2],
        [3, 4],
      ];
    case "2+1_SLEEPER":
    case "2+1_SEATER":
      return [[1, 2]];
    case "1+1_SLEEPER":
      return [];
    default:
      return [[1, 2]];
  }
};
const checkLadiesSeatProtection = async (
  schedule,
  passengerDetails,
  layoutType,
) => {
  const hasMales = passengerDetails.some((p) => p.gender === "male");
  const hasFemales = passengerDetails.some((p) => p.gender === "female");
  if (!hasMales) return;
  if (hasMales && hasFemales) return;
  const adjacentPairs = getAdjacentColumnPairs(layoutType);
  for (const passenger of passengerDetails) {
    if (passenger.gender !== "male") continue;
    const mySeat = schedule.seats.find(
      (s) => s.seatNumber === passenger.seatNumber,
    );
    if (!mySeat) continue;
    const adjacentBookedFemaleSeats = schedule.seats.filter((s) => {
      if (s.seatNumber === mySeat.seatNumber) return false;
      if (s.status !== "BOOKED") return false;
      if (s.passengerGender !== "F") return false;
      if (s.row !== mySeat.row) return false;
      if (s.deck !== mySeat.deck) return false;
      return adjacentPairs.some(
        ([c1, c2]) =>
          (mySeat.column === c1 && s.column === c2) ||
          (mySeat.column === c2 && s.column === c1),
      );
    });
    for (const adjSeat of adjacentBookedFemaleSeats) {
      const adjBooking = await Booking.findOne({
        scheduleId: schedule._id,
        bookedSeats: adjSeat.seatNumber,
        bookingStatus: "CONFIRMED",
      }).select("passengerDetails");
      if (!adjBooking) continue;
      const adjacentBookingHasMale = adjBooking.passengerDetails.some(
        (p) => p.gender === "male",
      );
      if (adjacentBookingHasMale) continue;
      throw new ApiError(
        403,
        `Seat ${passenger.seatNumber} is directly adjacent to seat ${adjSeat.seatNumber} which is occupied by a solo female passenger. ` +
          `As per our ladies safety policy, this seat cannot be booked by a male travelling alone.`,
      );
    }
  }
};

export const createBookingService = async (userId, payload) => {
  const { scheduleId, boardingPointId, droppingPointId, passengerDetails } =
    payload;
  const seatNumbers = passengerDetails.map((p) => p.seatNumber);
  const pipeline = redis.pipeline();
  for (const seatNumber of seatNumbers) {
    pipeline.get(`seat_lock:${scheduleId}:${seatNumber}`);
  }
  const lockResults = await pipeline.exec();
  for (let i = 0; i < seatNumbers.length; i++) {
    const [err, lockedBy] = lockResults[i];
    if (err) throw new ApiError(500, "Redis error while verifying seat locks.");
    if (!lockedBy) {
      throw new ApiError(
        409,
        `Seat ${seatNumbers[i]} is no longer reserved. Please go back and re-select your seats.`,
      );
    }
    if (lockedBy !== userId.toString()) {
      throw new ApiError(
        409,
        `Seat ${seatNumbers[i]} was blocked by another user. Please choose different seats.`,
      );
    }
  }
  const schedule = await Schedule.findById(scheduleId).populate(
    "busId",
    "seatLayoutType operatorId operatorName",
  );
  if (!schedule) throw new ApiError(404, "Schedule not found.");
  const busLayoutType = schedule.busId?.seatLayoutType || "2+2_SEATER";
  await checkLadiesSeatProtection(schedule, passengerDetails, busLayoutType);
  if (passengerDetails.length !== seatNumbers.length) {
    throw new ApiError(
      400,
      "Passenger count must match the number of booked seats.",
    );
  }
  const boardingPoint = schedule.boardingPoints.id(boardingPointId);
  if (!boardingPoint)
    throw new ApiError(400, "Invalid boarding point selected.");
  const droppingPoint = schedule.droppingPoints.id(droppingPointId);
  if (!droppingPoint)
    throw new ApiError(400, "Invalid dropping point selected.");
  let baseFare = 0;
  const seatFareMap = {};
  for (const seatNumber of seatNumbers) {
    const seat = schedule.seats.find((s) => s.seatNumber === seatNumber);
    if (!seat)
      throw new ApiError(
        400,
        `Seat ${seatNumber} does not exist on this schedule.`,
      );
    if (seat.status === "BOOKED") {
      throw new ApiError(
        409,
        `Seat ${seatNumber} was just booked by another user.`,
      );
    }
    seatFareMap[seatNumber] = seat.fare || schedule.baseFare;
    baseFare += seatFareMap[seatNumber];
  }
  const gstAmount = Math.round(baseFare * 0.05);
  const totalFare = baseFare + gstAmount;
  const session = await mongoose.startSession();
  let booking;
  try {
    await session.withTransaction(async () => {
      const isFlightSchedule =
        schedule.routeId?.source?.city &&
        schedule.routeId?.destination?.city &&
        !schedule.busId;
      [booking] = await Booking.create(
        [
          {
            userId,
            scheduleId,
            busId: schedule.busId?._id || null,
            operatorId: schedule.operatorId,
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
            cancellationPolicy: schedule.cancellationPolicy,
            bookingStatus: "PENDING",
            paymentStatus: "PENDING",
          },
        ],
        {
          session,
        },
      );
      for (const seatNumber of seatNumbers) {
        const seatIndex = schedule.seats.findIndex(
          (s) => s.seatNumber === seatNumber,
        );
        if (seatIndex !== -1) {
          const pax = passengerDetails.find((p) => p.seatNumber === seatNumber);
          const genderMap = {
            male: "M",
            female: "F",
            other: "O",
          };
          schedule.seats[seatIndex].status = "BOOKED";
          schedule.seats[seatIndex].passengerName = pax?.name || "";
          schedule.seats[seatIndex].passengerGender =
            genderMap[pax?.gender] ?? null;
          schedule.seats[seatIndex].passengerAge = pax?.age ?? null;
          schedule.seats[seatIndex].bookedBy = userId;
        }
      }
      schedule.availableSeats = Math.max(
        0,
        schedule.availableSeats - seatNumbers.length,
      );
      await schedule.save({
        session,
      });
    });
  } finally {
    session.endSession();
  }
  const delPipeline = redis.pipeline();
  for (const seatNumber of seatNumbers) {
    delPipeline.del(`seat_lock:${scheduleId}:${seatNumber}`);
  }
  await delPipeline.exec();
  return booking;
};

export const getBookingByIdService = async (userId, bookingId) => {
  const booking = await Booking.findOne({
    bookingId,
  })
    .populate("userId", "name email phoneNo")
    .populate(
      "scheduleId",
      "departureDate departureTime arrivalTime arrivalDate baseFare",
    )
    .populate({
      path: "busId",
      select: "busName busNumber busType seatLayoutType amenities operatorName",
    })
    .populate({
      path: "routeId",
      select:
        "source destination stops distanceInKm estimatedDurationInMinutes",
    });
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId._id.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to view this booking.");
  }
  return booking;
};

export const getMyBookingsService = async (userId) => {
  const bookings = await Booking.find({
    userId,
  })
    .sort({
      bookedAt: -1,
    })
    .populate(
      "busId",
      "busName busNumber busType operatorName airlineName flightNumber aircraftType",
    )
    .populate("routeId", "source destination")
    .populate(
      "scheduleId",
      "departureDate departureTime arrivalTime arrivalDate",
    )
    .select(
      "bookingId bookingStatus paymentStatus paymentReference totalFare bookedSeats bookedAt travelDate cancelledAt boardingPoint droppingPoint passengerDetails scheduleId busId routeId",
    );
  return bookings;
};

export const getVendorBookingsService = async (operatorId, filters = {}) => {
  const { status, scheduleId, page = 1, limit = 20 } = filters;
  const query = {
    operatorId,
  };
  if (status) {
    const validStatuses = ["PENDING", "CONFIRMED", "CANCELLED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      throw new ApiError(
        400,
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }
    query.bookingStatus = status.toUpperCase();
  }
  if (scheduleId) {
    query.scheduleId = scheduleId;
  }
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;
  const [bookings, totalCount] = await Promise.all([
    Booking.find(query)
      .sort({
        bookedAt: -1,
      })
      .skip(skip)
      .limit(limitNum)
      .populate("userId", "name email phoneNo")
      .populate("busId", "busName busNumber busType")
      .populate("routeId", "source destination")
      .populate("scheduleId")
      .select("-cancellationPolicy -__v"),
    Booking.countDocuments(query),
  ]);
  const processedBookings = await Promise.all(
    bookings.map(async (booking) => {
      if (!booking.scheduleId) return booking;
      const scheduleId = booking.scheduleId._id || booking.scheduleId;
      const scheduleObj = booking.scheduleId.toObject
        ? booking.scheduleId.toObject()
        : booking.scheduleId;
      if (scheduleObj?.flightId) {
        const { FlightSchedule } =
          await import("../../flights/models/flightSchedule.model.js");
        const schedule = await FlightSchedule.findById(scheduleId)
          .populate(
            "flightId",
            "airlineName registrationNumber aircraftModel aircraftType cabinClasses amenities operatorName",
          )
          .populate("routeId", "source destination stops")
          .select("-seats");
        if (schedule) {
          return {
            ...booking.toObject(),
            scheduleId: schedule.toObject(),
          };
        }
      } else if (scheduleObj?.busId) {
        const { Schedule } = await import("../../bus/models/schedule.model.js");
        const schedule = await Schedule.findById(scheduleId)
          .populate("busId", "busName busNumber busType")
          .populate("routeId", "source destination")
          .select("-seats");
        if (schedule) {
          return {
            ...booking.toObject(),
            scheduleId: schedule.toObject(),
          };
        }
      }
      return booking;
    }),
  );
  return {
    bookings: processedBookings,
    pagination: {
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      limit: limitNum,
    },
  };
};

export const cancelBookingService = async (userId, bookingId) => {
  const booking = await Booking.findOne({
    bookingId,
  });
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to cancel this booking.");
  }
  if (booking.bookingStatus === "CANCELLED") {
    throw new ApiError(409, "This booking is already cancelled.");
  }
  if (booking.bookingStatus !== "CONFIRMED") {
    throw new ApiError(400, "Only confirmed bookings can be cancelled.");
  }
  const refundAmount = calculateRefund(booking);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const schedule = await Schedule.findById(booking.scheduleId).session(
        session,
      );
      if (schedule) {
        for (const seatNumber of booking.bookedSeats) {
          const seatIndex = schedule.seats.findIndex(
            (s) => s.seatNumber === seatNumber,
          );
          if (seatIndex !== -1) {
            schedule.seats[seatIndex].status = "AVAILABLE";
            schedule.seats[seatIndex].passengerName = null;
            schedule.seats[seatIndex].passengerGender = null;
            schedule.seats[seatIndex].passengerAge = null;
            schedule.seats[seatIndex].bookedBy = null;
          }
        }
        schedule.availableSeats += booking.bookedSeats.length;
        await schedule.save({
          session,
        });
      }
      booking.bookingStatus = "CANCELLED";
      booking.paymentStatus = refundAmount > 0 ? "REFUNDED" : "SUCCESS";
      booking.refundAmount = refundAmount;
      booking.cancelledAt = new Date();
      await booking.save({
        session,
      });
    });
  } finally {
    session.endSession();
  }
  if (refundAmount > 0) {
    await initiateRefund(booking._id, refundAmount);
  }
  try {
    const user = await User.findById(booking.userId).select("name email");
    const [routeDoc, scheduleDoc] = await Promise.all([
      mongoose
        .model("Route")
        .findById(booking.routeId)
        .select("source destination")
        .lean(),
      Schedule.findById(booking.scheduleId)
        .select("departureDate departureTime")
        .lean(),
    ]);
    const depDate = scheduleDoc?.departureDate
      ? new Date(scheduleDoc.departureDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        })
      : "—";
    if (user?.email) {
      await sendBookingCancellationEmail(user.email, {
        bookingId: booking.bookingId,
        userName: user.name,
        source: routeDoc?.source?.city || "N/A",
        destination: routeDoc?.destination?.city || "N/A",
        departureDate: depDate,
        departureTime: scheduleDoc?.departureTime || "N/A",
        totalFare: booking.totalFare,
        refundAmount,
        cancelledAt: booking.cancelledAt,
      });
    }
  } catch (emailErr) {
    logger.warn("Cancellation email error (non-fatal)", {
      error: emailErr.message,
      bookingId: booking.bookingId,
    });
  }
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

export const calculateRefund = (booking) => {
  const departureDate = booking.departureDate;
  if (!departureDate) return 0;
  const now = new Date();
  const hoursUntilDeparture = (departureDate - now) / (1000 * 60 * 60);
  if (hoursUntilDeparture <= 0) return 0;
  const sortedPolicy = [...(booking.cancellationPolicy || [])].sort(
    (a, b) => b.hoursBeforeDeparture - a.hoursBeforeDeparture,
  );
  for (const tier of sortedPolicy) {
    if (hoursUntilDeparture >= tier.hoursBeforeDeparture) {
      return Math.round((booking.totalFare * tier.refundPercentage) / 100);
    }
  }
  return 0;
};

export const downloadTicketService = async (userId, bookingId) => {
  const booking = await Booking.findOne({
    bookingId,
  })
    .populate("userId", "name email")
    .populate("busId", "busName busNumber busType operatorName")
    .populate("routeId", "source destination")
    .populate("scheduleId", "departureDate departureTime arrivalTime");
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId._id.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to download this ticket.");
  }
  if (booking.bookingStatus !== "CONFIRMED") {
    throw new ApiError(
      400,
      `A ticket PDF is only available for confirmed bookings. ` +
        `This booking is ${booking.bookingStatus}.`,
    );
  }
  const pdfBuffer = await generateTicketPDF(booking);
  return {
    pdfBuffer,
    bookingId: booking.bookingId,
  };
};
