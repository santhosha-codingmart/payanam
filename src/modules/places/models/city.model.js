// ─────────────────────────────────────────────────────────────────────────────
// City Model
//
// This is the single source of truth for all cities in the platform.
// Cities are seeded on startup from the JSON file, and automatically grown
// whenever a vendor creates a new bus route.
//
// WHY A SEPARATE COLLECTION?
//   Hardcoding cities is fragile — the list becomes stale, can't be updated at
//   runtime, and can't store additional metadata like state or popularity.
//   A MongoDB collection lets us add/remove cities without code deploys, and
//   gives us the `popularity` field to rank cities that appear more in routes
//   (e.g., Mumbai, Delhi should rank above Budaun).
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const citySchema = new mongoose.Schema(
    {
        // The canonical name of the city (trimmed + title-cased)
        // e.g., "Chennai", "New Delhi", "Coimbatore"
        name: {
            type: String,
            required: true,
            trim: true,
            index: true, // Indexed for fast prefix-style queries
        },

        // The state this city belongs to
        // Required to disambiguate cities with the same name in different states
        // (e.g., "Salem" exists in both Tamil Nadu and Oregon — we store only Indian ones)
        state: {
            type: String,
            required: true,
            trim: true,
        },

        // Country is always India for this platform, but stored for extensibility
        country: {
            type: String,
            default: "India",
            trim: true,
        },

        // Popularity score — incremented every time this city appears in a route.
        // Used to sort search results so major hubs (Chennai, Mumbai) appear first.
        // WHY: A user typing "mum" should see "Mumbai" before "Mundra"
        popularity: {
            type: Number,
            default: 0,
            index: true, // Indexed so we can sort efficiently
        },
    },
    {
        timestamps: true, // createdAt + updatedAt managed automatically
    }
);

// ── Compound Unique Index ─────────────────────────────────────────────────────
// Prevents duplicate cities: "Chennai" + "Tamil Nadu" can only exist ONCE.
// This is the guard that makes upsert safe — MongoDB will reject any insert
// that violates this constraint before it even hits our application code.
citySchema.index({ name: 1, state: 1 }, { unique: true });

export const City = mongoose.model("City", citySchema);
