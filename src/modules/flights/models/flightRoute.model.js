// ─────────────────────────────────────────────────────────────────────────────
// FlightRoute Model — The path a flight takes between airports
// This represents the physical journey from Airport A to Airport B, including
// any technical stops (layovers). It belongs to a specific Flight (aircraft).
//
// WHY A SEPARATE MODEL?
//   A single aircraft (Flight) can fly multiple routes. E.g., VT-IGP flies
//   both DEL→BOM and BOM→HYD. Separating routes keeps the Flight model clean.
//
// HOW MULTI-STOP SEARCH WORKS:
//   If a route is DEL(1) → BOM(2) → GOA(3), a user searching "BOM to GOA"
//   will still find this flight because both cities appear in the `stops` array
//   and BOM has a lower `order` than GOA.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

// ── Airport Sub-Schema ────────────────────────────────────────────────────────
// Reused for source, destination, and individual stops.
// We store the 3-letter IATA code (e.g., "DEL", "BOM") for standard referencing.

const airportSchema = {
    // Airport name (e.g., "Indira Gandhi International Airport")
    name: { type: String, required: true, trim: true },

    // IATA 3-letter airport code (e.g., "DEL", "BOM", "MAA", "BLR")
    // This is the industry-standard identifier used on boarding passes.
    iataCode: {
        type: String,
        required: true,
        uppercase: true, // Auto-converts "del" → "DEL"
        trim: true,
        minlength: 3,
        maxlength: 3,
    },

    // City this airport serves
    city: { type: String, required: true, trim: true },

    // Country (useful for international routes)
    country: { type: String, required: true, trim: true, default: "India" },
};

// ── Main Schema ───────────────────────────────────────────────────────────────
const flightRouteSchema = new mongoose.Schema(
    {
        // ── Flight Reference ─────────────────────────────────────────────────
        // Which physical aircraft operates on this route?
        // This links the route back to the Flight model (and transitively to the vendor).
        flightId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Flight",
            required: true,
            index: true, // Speeds up: "find all routes for flight X"
        },

        // ── Route Endpoints ──────────────────────────────────────────────────

        // The departure airport for this entire route
        source: airportSchema,

        // The final arrival airport of the entire route
        destination: airportSchema,

        // ── Intermediate Stops (The Magic) ───────────────────────────────────
        // An ORDERED list of ALL airports on this route (including source & destination).
        // This is what enables multi-city and layover search.
        //
        // EXAMPLE:
        //   Route: DEL(order:1) → BOM(order:2) → GOA(order:3)
        //   Search "BOM → GOA" will match because:
        //   - BOM exists in stops (order=2)
        //   - GOA exists in stops (order=3)
        //   - BOM's order < GOA's order ✓ (correct direction)
        stops: [
            {
                // Airport details for this stop
                name: { type: String, required: true, trim: true },
                iataCode: {
                    type: String,
                    required: true,
                    uppercase: true,
                    trim: true,
                },
                city: { type: String, required: true, trim: true },
                country: { type: String, trim: true, default: "India" },

                // Time the aircraft lands at this stop (Format: "HH:mm" 24hr)
                arrivalTime: { type: String, required: true },

                // Time the aircraft departs from this stop (Format: "HH:mm" 24hr)
                departureTime: { type: String, required: true },

                // How many minutes from the very first departure has elapsed
                // when the flight reaches this stop?
                // Used to compute partial journey durations.
                // E.g., DEL→BOM=90 min, BOM→GOA=60 min → BOM offset=90
                minutesFromSource: { type: Number, default: 0 },

                // DIRECTION ENFORCER: The sequence position (1, 2, 3...)
                // If DEL=1, BOM=2, GOA=3, then:
                //   DEL→GOA is valid (1 < 3)
                //   GOA→DEL is INVALID (3 is NOT < 1)
                order: { type: Number, required: true },
            },
        ],

        // ── Metrics & Pricing ─────────────────────────────────────────────────

        // Total distance from source to destination in kilometres
        distanceInKm: {
            type: Number,
            required: true,
            min: 1,
        },

        // Total expected flight time (source → destination) in minutes
        estimatedDurationInMinutes: {
            type: Number,
            required: true,
            min: 1,
        },

        // ── Status ───────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE"],
            default: "ACTIVE",
        },
    },
    {
        timestamps: true, // Auto-adds createdAt and updatedAt fields
    }
);

// ── Search Indexes ────────────────────────────────────────────────────────────

// Compound index for exact-match route searches: "DEL → BOM"
// Used when users search by source and destination IATA codes.
flightRouteSchema.index({ "source.iataCode": 1, "destination.iataCode": 1 });

// Index on source city name for city-based searches
flightRouteSchema.index({ "source.city": 1, "destination.city": 1 });

// Index on the nested stops.iataCode and stops.city fields.
// This is the primary index used by the searchFlightsService to find intermediate stops.
// Without this, MongoDB would do a full collection scan for every search query.
flightRouteSchema.index({ "stops.iataCode": 1 });
flightRouteSchema.index({ "stops.city": 1 });

export const FlightRoute = mongoose.model("FlightRoute", flightRouteSchema);
