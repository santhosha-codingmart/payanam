// ─────────────────────────────────────────────────────────────────────────────
// Route Model — The path a bus takes
// This represents the physical journey from city A to city B, including
// all intermediate stops. It belongs to a specific Bus.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
    {
        // ── Bus Reference ────────────────────────────────────────────────
        // Which physical bus operates on this route?
        // This links the route to the `Bus` model, which also links us back to the vendor.
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
            index: true, // Speeds up queries like "find all routes for bus X"
        },

        // ── Endpoints ────────────────────────────────────────────────────
        // The starting city of the entire route
        source: {
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
        },

        // The final destination city of the entire route
        destination: {
            city: { type: String, required: true, trim: true },
            state: { type: String, required: true, trim: true },
        },

        // ── Intermediate Stops (The Magic) ───────────────────────────────
        // Ordered list of ALL stops including source and destination.
        // This array enables us to search for partial trips!
        // E.g., if Route: Chennai(1) → Vellore(2) → Bangalore(3)
        // User can search "Vellore to Bangalore" and find this route.
        stops: [
            {
                city: { type: String, required: true, trim: true },
                state: { type: String, trim: true },
                
                // When does the bus arrive/depart this stop?
                // Used to show users accurate times for partial trips.
                arrivalTime: { type: String, required: true }, // Format: "HH:mm" (24hr)
                departureTime: { type: String, required: true }, // Format: "HH:mm" (24hr)
                
                // How far is this stop from the very beginning of the route?
                // Used to calculate partial distance:
                // Bangalore(350km) - Vellore(130km) = 220km travel distance
                distanceFromSource: { type: Number, default: 0 }, 
                
                // CRITICAL FIELD: The sequence order (1, 2, 3...)
                // Prevents reverse-direction matches.
                // If Vellore(2) and Bangalore(3), then Vellore→Bangalore is valid (2 < 3).
                // But Bangalore→Vellore is invalid (3 is not < 2).
                order: { type: Number, required: true },
            },
        ],

        // ── Metrics & Pricing ────────────────────────────────────────────
        // Total distance from source to destination
        distanceInKm: {
            type: Number,
            required: true,
            min: 1,
        },

        // Price per kilometer
        // If a user travels 220km, base fare = 220 * farePerKm
        // Allows dynamic pricing for intermediate stops
        farePerKm: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Total expected duration in minutes for the full route
        estimatedDurationInMinutes: {
            type: Number,
            required: true,
            min: 1,
        },

        // ── Status ───────────────────────────────────────────────────────
        // Is this route currently active?
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
        },
    },
    {
        timestamps: true, // Auto-adds createdAt and updatedAt
    }
);

// ── Indexes for Search Optimization ──────────────────────────────────────

// Compound index for fast exact-match searches: "source city → destination city"
// Useful when people search for the full route endpoints.
routeSchema.index({ "source.city": 1, "destination.city": 1 });

// Index on the nested stops.city field.
// This is heavily used by the searchBusesService to find intermediate stops.
// Makes searching inside arrays lightning fast!
routeSchema.index({ "stops.city": 1 });

export const Route = mongoose.model("Route", routeSchema);