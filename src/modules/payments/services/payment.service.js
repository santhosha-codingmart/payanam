import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import Booking from "../../bookings/models/booking.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import redis from "../../../config/redis.js";
import { ApiError } from "../../../utils/ApiError.js";
import { sendBookingConfirmationEmail } from "../../../utils/email.service.js";
import { generateTicketPDF } from "../../../utils/ticket.pdf.service.js";
import logger from "../../../config/logger.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createRazorpayOrder = async (userId, bookingMongoId) => {
  const booking = await Booking.findById(bookingMongoId);
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to pay for this booking.");
  }
  if (
    booking.bookingStatus === "CONFIRMED" &&
    booking.paymentStatus === "SUCCESS"
  ) {
    throw new ApiError(409, "This booking has already been paid for.");
  }
  if (booking.bookingStatus === "CANCELLED") {
    throw new ApiError(
      409,
      "This booking has been cancelled. Please create a new booking.",
    );
  }
  const existingPayment = await Payment.findOne({
    bookingId: booking._id,
    status: "CREATED",
  });
  if (existingPayment) {
    return {
      razorpayOrderId: existingPayment.razorpayOrderId,
      amount: existingPayment.amount,
      currency: existingPayment.currency,
      bookingMongoId: booking._id,
      bookingId: booking.bookingId,
    };
  }
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(booking.totalFare * 100),
    currency: "INR",
    receipt: booking.bookingId,
    notes: {
      bookingId: booking.bookingId,
      userId: userId.toString(),
      scheduleId: booking.scheduleId.toString(),
    },
  });
  await Payment.create({
    bookingId: booking._id,
    userId,
    razorpayOrderId: razorpayOrder.id,
    amount: booking.totalFare,
    currency: "INR",
    status: "CREATED",
  });
  return {
    razorpayOrderId: razorpayOrder.id,
    amount: booking.totalFare,
    currency: "INR",
    bookingMongoId: booking._id,
    bookingId: booking.bookingId,
  };
};

export const verifyAndConfirmPayment = async (userId, payload) => {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    bookingMongoId,
  } = payload;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  if (expectedSignature !== razorpaySignature) {
    logger.error("Payment signature mismatch", {
      razorpayOrderId,
    });
    throw new ApiError(400, "Payment verification failed. Invalid signature.");
  }
  const payment = await Payment.findOne({
    razorpayOrderId,
  });
  if (!payment) {
    throw new ApiError(404, "No payment record found for this order ID.");
  }
  if (payment.status === "SUCCESS") {
    throw new ApiError(409, "This payment has already been verified.");
  }
  const booking = await Booking.findById(bookingMongoId);
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId.toString() !== userId.toString()) {
    throw new ApiError(403, "You are not authorized to verify this payment.");
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      booking.bookingStatus = "CONFIRMED";
      booking.paymentStatus = "SUCCESS";
      booking.paymentReference = razorpayPaymentId;
      booking.bookedAt = new Date();
      await booking.save({
        session,
      });
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = "SUCCESS";
      await payment.save({
        session,
      });
    });
  } finally {
    session.endSession();
  }
  try {
    const schedule = await Schedule.findById(booking.scheduleId).select(
      "seats",
    );
    if (schedule) {
      const pipeline = redis.pipeline();
      for (const seatNumber of booking.bookedSeats) {
        pipeline.del(`seat_lock:${booking.scheduleId}:${seatNumber}`);
      }
      await pipeline.exec();
    }
  } catch (redisErr) {
    logger.warn("Redis seat lock cleanup error (non-fatal)", {
      error: redisErr.message,
    });
  }
  const confirmedBooking = await Booking.findById(bookingMongoId)
    .populate("userId", "name email")
    .populate("busId", "busName busNumber busType operatorName")
    .populate("routeId", "source destination")
    .populate("scheduleId", "departureDate departureTime arrivalTime");
  setImmediate(async () => {
    try {
      const u = confirmedBooking.userId;
      const sch = confirmedBooking.scheduleId;
      const rt = confirmedBooking.routeId;
      const bus = confirmedBooking.busId;
      const bp = confirmedBooking.boardingPoint;
      const dp = confirmedBooking.droppingPoint;
      const depDate = sch?.departureDate
        ? new Date(sch.departureDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          })
        : "—";
      const pdfBuffer = await generateTicketPDF(confirmedBooking);
      await sendBookingConfirmationEmail(u.email, {
        bookingId: confirmedBooking.bookingId,
        userName: u.name,
        busName: bus?.busName || "—",
        busNumber: bus?.busNumber || "—",
        source: rt?.source?.city || "—",
        destination: rt?.destination?.city || "—",
        departureDate: depDate,
        departureTime: sch?.departureTime || "—",
        arrivalTime: sch?.arrivalTime || "—",
        boardingPoint: bp ? `${bp.name}, ${bp.time}` : "—",
        droppingPoint: dp ? `${dp.name}, ${dp.time}` : "—",
        passengers: confirmedBooking.passengerDetails,
        totalFare: confirmedBooking.totalFare,
        paymentId: razorpayPaymentId,
        pdfBuffer,
      });
      logger.info("Booking confirmation email sent", {
        bookingId: confirmedBooking.bookingId,
      });
    } catch (emailErr) {
      logger.warn("Booking confirmation email error (non-fatal)", {
        error: emailErr.message,
      });
    }
  });
  return {
    booking: confirmedBooking,
    payment: {
      razorpayOrderId: payment.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt,
    },
  };
};

export const handlePaymentFailure = async (userId, payload) => {
  const { razorpayOrderId, errorCode, errorDescription, bookingMongoId } =
    payload;
  const payment = await Payment.findOne({
    razorpayOrderId,
  });
  if (payment && payment.status === "CREATED") {
    payment.status = "FAILED";
    payment.failureReason = errorDescription || errorCode;
    await payment.save();
  }
  logger.warn("Payment failure recorded", {
    razorpayOrderId,
    errorCode,
    errorDescription,
  });
  return {
    message:
      "Payment failure recorded. You can retry payment for this booking.",
    bookingMongoId,
    canRetry: true,
  };
};

export const initiateRefund = async (bookingMongoId, refundAmount) => {
  const payment = await Payment.findOne({
    bookingId: bookingMongoId,
    status: "SUCCESS",
  });
  if (!payment || !payment.razorpayPaymentId) {
    logger.warn("No Razorpay payment found for refund — skipping", {
      bookingMongoId,
    });
    return null;
  }
  try {
    const razorpayRefund = await razorpay.payments.refund(
      payment.razorpayPaymentId,
      {
        amount: Math.round(refundAmount * 100),
        notes: {
          reason: "Customer requested cancellation",
          bookingId: bookingMongoId.toString(),
        },
      },
    );
    payment.status = "REFUNDED";
    payment.refundId = razorpayRefund.id;
    payment.refundAmount = refundAmount;
    payment.refundInitiatedAt = new Date();
    await payment.save();
    return razorpayRefund;
  } catch (razorpayErr) {
    logger.error("Razorpay refund API error", {
      razorpayPaymentId: payment.razorpayPaymentId,
      error: razorpayErr.message,
    });
    return null;
  }
};

export const getPaymentStatus = async (userId, bookingMongoId) => {
  const booking = await Booking.findById(bookingMongoId).select(
    "userId bookingId bookingStatus paymentStatus",
  );
  if (!booking) throw new ApiError(404, "Booking not found.");
  if (booking.userId.toString() !== userId.toString()) {
    throw new ApiError(
      403,
      "You are not authorized to view this payment status.",
    );
  }
  const payment = await Payment.findOne({
    bookingId: bookingMongoId,
  })
    .sort({
      createdAt: -1,
    })
    .select(
      "razorpayOrderId razorpayPaymentId amount currency status refundId refundAmount createdAt",
    );
  return {
    booking: {
      bookingId: booking.bookingId,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.paymentStatus,
    },
    payment: payment || null,
  };
};
