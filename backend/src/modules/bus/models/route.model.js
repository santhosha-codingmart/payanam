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
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
        },

        destination: {
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
        },

        // Ordered list of intermediate stops including source and destination
        stops: [
            {
                city: { type: String, required: true, trim: true },
                state: { type: String, trim: true },
                arrivalTime: { type: String, required: true }, // "HH:mm"
                departureTime: { type: String, required: true }, // "HH:mm"
                distanceFromSource: { type: Number, default: 0 }, // km from source
                order: { type: Number, required: true },
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
    }
);

// Compound index for fast search: "from city → to city"
routeSchema.index({ "source.city": 1, "destination.city": 1 });

export const Route = mongoose.model("Route", routeSchema);