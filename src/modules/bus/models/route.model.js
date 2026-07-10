import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    source: {
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
    },
    destination: {
      city: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
        trim: true,
      },
    },
    stops: [
      {
        city: {
          type: String,
          required: true,
          trim: true,
        },
        state: {
          type: String,
          trim: true,
        },
        arrivalTime: {
          type: String,
          required: true,
        },
        departureTime: {
          type: String,
          required: true,
        },
        distanceFromSource: {
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
    farePerKm: {
      type: Number,
      default: 0,
      min: 0,
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
routeSchema.index({
  "source.city": 1,
  "destination.city": 1,
});
routeSchema.index({
  "stops.city": 1,
});

export const Route = mongoose.model("Route", routeSchema);
