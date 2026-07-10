import mongoose from "mongoose";
import crypto from "crypto";

const passengerSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    age: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
    },
    idType: {
      type: String,
      enum: ["AADHAR", "PAN", "PASSPORT", "DRIVING_LICENSE"],
      required: false,
      default: null,
    },
    idNumber: {
      type: String,
      default: null,
    },
  },
  {
    _id: false,
  },
);
const pointSchema = new mongoose.Schema(
  {
    pointId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    city: {
      type: String,
    },
    name: {
      type: String,
    },
    address: {
      type: String,
    },
    time: {
      type: String,
    },
  },
  {
    _id: false,
  },
);
const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
      index: true,
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    boardingPoint: {
      type: pointSchema,
      required: true,
    },
    droppingPoint: {
      type: pointSchema,
      required: true,
    },
    passengerDetails: {
      type: [passengerSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: "At least one passenger is required",
      },
    },
    bookedSeats: {
      type: [String],
      required: true,
    },
    totalFare: {
      type: Number,
      required: true,
      min: 0,
    },
    cancellationPolicy: [
      {
        hoursBeforeDeparture: Number,
        refundPercentage: Number,
        _id: false,
      },
    ],
    bookingStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      default: "PENDING",
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING",
    },
    paymentReference: {
      type: String,
      default: null,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    bookedAt: {
      type: Date,
      default: null,
    },
    travelDate: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
bookingSchema.pre("save", async function () {
  if (!this.bookingId) {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    this.bookingId = `PAY-${randomHex}`;
  }
});
bookingSchema.index({
  scheduleId: 1,
  bookedSeats: 1,
});
const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
