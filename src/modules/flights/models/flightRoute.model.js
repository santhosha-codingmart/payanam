import mongoose from "mongoose";

const airportSchema = {
  name: {
    type: String,
    required: true,
    trim: true,
  },
  iataCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: "India",
  },
};
const flightRouteSchema = new mongoose.Schema(
  {
    flightId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Aircraft",
      required: true,
      index: true,
    },
    source: airportSchema,
    destination: airportSchema,
    stops: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        iataCode: {
          type: String,
          required: true,
          uppercase: true,
          trim: true,
        },
        city: {
          type: String,
          required: true,
          trim: true,
        },
        country: {
          type: String,
          trim: true,
          default: "India",
        },
        arrivalTime: {
          type: String,
          required: true,
        },
        departureTime: {
          type: String,
          required: true,
        },
        minutesFromSource: {
          type: Number,
          default: 0,
        },
        order: {
          type: Number,
          required: true,
        },
      },
    ],
    distanceInKm: {
      type: Number,
      required: true,
      min: 1,
    },
    estimatedDurationInMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  },
);
flightRouteSchema.index({
  "source.iataCode": 1,
  "destination.iataCode": 1,
});
flightRouteSchema.index({
  "source.city": 1,
  "destination.city": 1,
});
flightRouteSchema.index({
  "stops.iataCode": 1,
});
flightRouteSchema.index({
  "stops.city": 1,
});

export const FlightRoute = mongoose.model("FlightRoute", flightRouteSchema);
