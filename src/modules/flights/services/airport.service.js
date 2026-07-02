import Fuse from "fuse.js";
import { Airport } from "../models/airport.model.js";

// ── In-Memory State ───────────────────────────────────────────────────────────
let airportCache = [];
let fuseIndex = null;

// ── Fuse.js Configuration ─────────────────────────────────────────────────────
const FUSE_OPTIONS = {
    // We search across iataCode, city, and name.
    // We assign weights so an exact IATA code match (e.g. "DEL") ranks higher
    // than the city name, which ranks higher than the airport name.
    keys: [
        { name: "iataCode", weight: 0.5 },
        { name: "city", weight: 0.3 },
        { name: "name", weight: 0.2 },
    ],
    includeScore: true,
    threshold: 0.3, // Strict threshold for airports since codes are specific
    distance: 100,
    minMatchCharLength: 1,
};

function buildFuseIndex() {
    fuseIndex = new Fuse(airportCache, FUSE_OPTIONS);
}

// ─────────────────────────────────────────────────────────────────────────────
// initAirportCache (Called on server startup)
// ─────────────────────────────────────────────────────────────────────────────
export async function initAirportCache() {
    // Sort by popularity DESC then city ASC
    const airports = await Airport.find({}, { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 })
        .sort({ popularity: -1, city: 1 })
        .lean();

    airportCache = airports;
    buildFuseIndex();

    console.log(`✈️  Airport cache initialized: ${airportCache.length} airports loaded`);
}

// ─────────────────────────────────────────────────────────────────────────────
// searchAirports(query)
// ─────────────────────────────────────────────────────────────────────────────
export function searchAirports(query) {
    const q = query.trim();

    if (!q) return [];
    if (!fuseIndex) return [];

    const results = fuseIndex.search(q);

    // Sort by:
    // 1. Fuse score
    // 2. Popularity (higher is better)
    // 3. Alphabetical (IATA code)
    results.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (b.item.popularity !== a.item.popularity) return b.item.popularity - a.item.popularity;
        return a.item.iataCode.localeCompare(b.item.iataCode);
    });

    return results.slice(0, 10).map((r) => ({
        iataCode: r.item.iataCode,
        name: r.item.name,
        city: r.item.city,
        country: r.item.country,
        displayText: `${r.item.city} (${r.item.iataCode}) - ${r.item.name}`
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// bulkUpsertAirports(airports)
// Used when creating flight routes to auto-register airports.
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkUpsertAirports(airports) {
    if (!airports || airports.length === 0) return;

    const ops = airports.map((airport) => ({
        updateOne: {
            // Find by IATA code (globally unique)
            filter: { iataCode: airport.iataCode.toUpperCase() },
            update: {
                $setOnInsert: {
                    name: airport.name,
                    city: airport.city,
                    country: airport.country || "India"
                },
                // Increment popularity when used in routes
                $inc: { popularity: 1 },
            },
            upsert: true,
        },
    }));

    await Airport.bulkWrite(ops, { ordered: false });

    // Refresh cache so searches reflect new airports immediately
    await initAirportCache();
}
