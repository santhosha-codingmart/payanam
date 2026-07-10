import mongoose from "mongoose";
import crypto from "crypto";

const flightSnapshotSchema = new mongoose.Schema(
  {
    airlineName: {
      type: String,
      required: true,
    },
    flightNumber: {
      type: String,
      required: true,
    },
    source: {
      type: String,
      required: true,
    },
    destination: {
      type: String,
      required: true,
    },
    departureDate: {
      type: Date,
      required: true,
    },
    departureTime: {
      type: String,
      required: true,
    },
    arrivalTime: {
      type: String,
      required: true,
    },
    cabinClass: {
      type: String,
      default: "ECONOMY",
    },
  },
  {
    _id: false,
  },
);
const priceLockSchema = new mongoose.Schema(
  {
    priceLockId: {
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
      ref: "FlightSchedule",
      required: true,
      index: true,
    },
    lockedFare: {
      type: Number,
      required: true,
      min: 0,
    },
    lockFee: {
      type: Number,
      required: true,
      min: 0,
    },
    protectionLimit: {
      type: Number,
      default: 7500,
    },
    lockDurationId: {
      type: String,
      required: true,
      enum: ["4h", "8h", "12h", "1d", "3d", "7d"],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "USED", "EXPIRED", "REFUNDED"],
      default: "ACTIVE",
      index: true,
    },
    flightSnapshot: {
      type: flightSnapshotSchema,
      required: true,
    },
    paymentReference: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);
priceLockSchema.pre("save", async function () {
  if (!this.priceLockId) {
    const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    this.priceLockId = `PL-${randomHex}`;
  }
});
priceLockSchema.index({
  userId: 1,
  status: 1,
});
priceLockSchema.index({
  userId: 1,
  scheduleId: 1,
  status: 1,
});
const PriceLock = mongoose.model("PriceLock", priceLockSchema);

export default PriceLock;
