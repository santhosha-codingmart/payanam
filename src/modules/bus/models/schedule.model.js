import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
      index: true,
    },
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    departureDate: {
      type: Date,
      required: true,
    },
    arrivalDate: {
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
    baseFare: {
      type: Number,
      required: true,
      min: 0,
    },
    availableSeats: {
      type: Number,
      required: true,
      min: 0,
    },
    seats: [
      {
        seatNumber: {
          type: String,
          required: true,
        },
        seatType: {
          type: String,
          enum: ["window", "aisle", "middle"],
          default: "aisle",
        },
        deck: {
          type: String,
          enum: ["lower", "upper"],
          default: "lower",
        },
        row: {
          type: Number,
        },
        column: {
          type: Number,
        },
        isSleeper: {
          type: Boolean,
          default: false,
        },
        fare: {
          type: Number,
          default: 0,
        },
        status: {
          type: String,
          enum: ["AVAILABLE", "BOOKED", "BLOCKED"],
          default: "AVAILABLE",
        },
        bookedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        passengerName: {
          type: String,
          default: null,
        },
        passengerAge: {
          type: Number,
          default: null,
        },
        passengerGender: {
          type: String,
          enum: ["M", "F", "O", null],
          default: null,
        },
      },
    ],
    boardingPoints: [
      {
        city: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
        },
        address: {
          type: String,
        },
        time: {
          type: String,
          required: true,
        },
        landmark: {
          type: String,
        },
      },
    ],
    droppingPoints: [
      {
        city: {
          type: String,
          required: true,
          trim: true,
        },
        name: {
          type: String,
          required: true,
        },
        address: {
          type: String,
        },
        time: {
          type: String,
          required: true,
        },
        landmark: {
          type: String,
        },
      },
    ],
    cancellationPolicy: [
      {
        hoursBeforeDeparture: {
          type: Number,
          required: true,
        },
        refundPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
      },
    ],
    status: {
      type: String,
      enum: ["SCHEDULED", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
      default: "SCHEDULED",
    },
  },
  {
    timestamps: true,
  },
);
scheduleSchema.index({
  routeId: 1,
  departureDate: 1,
});
scheduleSchema.index({
  busId: 1,
  departureDate: 1,
  departureTime: 1,
});

export const Schedule = mongoose.model("Schedule", scheduleSchema);
