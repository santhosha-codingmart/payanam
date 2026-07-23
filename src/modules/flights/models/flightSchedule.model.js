import mongoose from "mongoose";

const flightScheduleSchema = new mongoose.Schema(
  {
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlightRoute",
      required: true,
      index: true,
    },
    flightId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aircraft",
      required: true,
      index: true,
    },
    flightNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
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
        cabinClass: {
          type: String,
          enum: ["ECONOMY", "PREMIUM_ECONOMY", "STANDARD_ECONOMY", "BUSINESS", "BUSINESS_SAVER", "FIRST"],
          default: "ECONOMY",
        },
        seatType: {
          type: String,
          enum: ["window", "aisle", "middle"],
          default: "aisle",
        },
        row: {
          type: Number,
        },
        column: {
          type: Number,
        },
        isExtraLegroom: {
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
    departureTerminal: {
      type: String,
      trim: true,
    },
    arrivalTerminal: {
      type: String,
      trim: true,
    },
    mealOptions: [
      {
        type: String,
        enum: ["VEG", "NON_VEG", "VEGAN", "JAIN", "DIABETIC"],
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
      enum: [
        "SCHEDULED",
        "BOARDING",
        "DEPARTED",
        "COMPLETED",
        "CANCELLED",
        "DELAYED",
      ],
      default: "SCHEDULED",
    },
  },
  {
    timestamps: true,
  },
);
flightScheduleSchema.index({
  routeId: 1,
  departureDate: 1,
});
flightScheduleSchema.index(
  {
    flightId: 1,
    departureDate: 1,
    departureTime: 1,
  },
  {
    unique: true,
  },
);

export const FlightSchedule = mongoose.model(
  "FlightSchedule",
  flightScheduleSchema,
);
