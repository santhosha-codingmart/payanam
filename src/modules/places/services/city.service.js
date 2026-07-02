// ─────────────────────────────────────────────────────────────────────────────
// City Service — All business logic for city search and management
//
// ARCHITECTURE OVERVIEW:
//
//   MongoDB (source of truth)
//       ↓  (loaded once on startup, reloaded only when data changes)
//   In-Memory Cache  ← [ allCities array ]
//       ↓  (index rebuilt from cache whenever cache changes)
//   Fuse.js Index    ← [ pre-built fuzzy search index ]
//       ↓  (queried on every keystroke — purely in-memory, no I/O)
//   Search Results
//
// WHY CACHING?
//   MongoDB queries involve network I/O + disk reads. For a search-as-you-type
//   feature, users may fire 10+ requests per second per user. Querying MongoDB
//   on every keystroke would cause unacceptable latency (50–200ms each) and
//   high DB load. An in-memory array lookup + Fuse.js takes <1ms.
//
// WHY FUSE.JS?
//   Fuse.js provides fuzzy matching: "Cheni" still matches "Chennai".
//   Pure MongoDB regex (^cheni$) would fail for typos. Fuse.js scores each
//   candidate by string similarity so we rank the closest matches first.
//
// WHY REBUILD THE INDEX?
//   The Fuse.js index is pre-computed at startup. When new cities are inserted
//   (e.g., a vendor creates a new route with a city not in the DB), the cache
//   is stale. We must rebuild the Fuse index from the updated DB snapshot so
//   the new city appears in suggestions immediately.
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";
import { City } from "../models/city.model.js";

// ── In-Memory State ───────────────────────────────────────────────────────────

// The in-memory snapshot of all cities loaded from MongoDB.
// Shape: [{ name: "Chennai", state: "Tamil Nadu" }, ...]
let cityCache = [];

// The Fuse.js search index — built once from cityCache.
// Queried on every user keystroke without any DB round-trip.
let fuseIndex = null;

// ── Fuse.js Configuration ─────────────────────────────────────────────────────

const FUSE_OPTIONS = {
    // Which fields to search in
    keys: ["name"],

    // Include the similarity score (0 = perfect match, 1 = no match)
    includeScore: true,

    // threshold: How fuzzy to be. 0.0 = exact match only, 1.0 = match everything.
    // 0.4 is a good balance: "Cheni" → "Chennai", but not "Delhi" → "Chennai"
    threshold: 0.4,

    // How far into the string to look for the pattern
    distance: 100,

    // Minimum character length of the query to attempt a match
    minMatchCharLength: 1,
};

// ── Index Builder ─────────────────────────────────────────────────────────────

/**
 * Builds (or rebuilds) the Fuse.js index from the current in-memory cache.
 *
 * WHY REBUILD?
 *   When new cities are inserted into MongoDB (e.g., via upsertCity), the cache
 *   is refreshed with the new data. Fuse.js must re-index that new data.
 *   Rebuilding is fast (~5ms for 1500 cities) and happens rarely.
 */
function buildFuseIndex() {
    fuseIndex = new Fuse(cityCache, FUSE_OPTIONS);
}

// ─────────────────────────────────────────────────────────────────────────────
// initCityCache
//
// Called ONCE at server startup (from server.js / after DB connects).
// Loads all cities from MongoDB, populates the cache, and builds the Fuse index.
// After this, every search is purely in-memory — zero DB reads per keystroke.
// ─────────────────────────────────────────────────────────────────────────────
export async function initCityCache() {
    // Sort by popularity DESC then name ASC so popular cities rank first
    const cities = await City.find({}, { name: 1, state: 1, popularity: 1, _id: 0 })
        .sort({ popularity: -1, name: 1 })
        .lean(); // .lean() returns plain JS objects (faster than Mongoose documents)

    cityCache = cities;
    buildFuseIndex();

    console.log(`✅ City cache initialized: ${cityCache.length} cities loaded`);
}

// ─────────────────────────────────────────────────────────────────────────────
// searchCities(query)
//
// The main search function. Called by the controller on every GET /places/search.
// Runs entirely in-memory — no DB query.
//
// Sorting priority (as required):
//   1. Fuse.js score (lowest = best match)
//   2. popularity descending (major hubs first)
//   3. alphabetical order (deterministic tiebreaker)
// ─────────────────────────────────────────────────────────────────────────────
export function searchCities(query) {
    const q = query.trim();

    // Empty query = no suggestions
    if (!q) return [];

    // If the cache isn't initialized yet, return empty rather than crashing
    if (!fuseIndex) return [];

    // Run Fuse.js fuzzy search — returns [{ item, score, ... }, ...]
    const results = fuseIndex.search(q);

    // Sort by:
    //   1. Fuse score (lower = better match, so ascending)
    //   2. popularity (higher = more common city, so descending)
    //   3. name alphabetically (stable tiebreaker)
    results.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (b.item.popularity !== a.item.popularity) return b.item.popularity - a.item.popularity;
        return a.item.name.localeCompare(b.item.name);
    });

    // Return max 10 results, shaped for the API response
    return results.slice(0, 10).map((r) => ({
        name: r.item.name,
        state: r.item.state,
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// toTitleCase(str)
//
// Normalizes city names: "  chennai  " → "Chennai", "new delhi" → "New Delhi"
//
// WHY NORMALIZE?
//   "Chennai" and "chennai" stored as separate documents = duplicates.
//   All city names must be stored in canonical title case so the unique index
//   can reliably prevent duplicates.
// ─────────────────────────────────────────────────────────────────────────────
function toTitleCase(str) {
    return str
        .trim()
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// upsertCity(name, state)
//
// Ensures a city exists in MongoDB. If it does, leave it unchanged.
// If it doesn't, create it. Never creates duplicates.
//
// HOW DUPLICATE PREVENTION WORKS:
//   1. Names are normalized to title case before any DB operation.
//   2. MongoDB's compound unique index { name, state } rejects duplicate inserts
//      at the DB level (even if two concurrent requests arrive simultaneously).
//   3. We use $setOnInsert so that if the city ALREADY EXISTS, we don't
//      overwrite any fields — specifically, we preserve the `popularity` score.
//   4. We use $inc to increment the popularity on every upsert call, tracking
//      how often this city is used in routes.
//
// After a successful upsert, we reload the cache and rebuild the Fuse index so
// the new city is immediately searchable.
// ─────────────────────────────────────────────────────────────────────────────
export async function upsertCity(name, state) {
    const normalizedName = toTitleCase(name);
    const normalizedState = toTitleCase(state);

    await City.findOneAndUpdate(
        // Filter: find by normalized name + state
        { name: normalizedName, state: normalizedState },
        {
            // $setOnInsert: Only applied if this is a NEW document (INSERT path)
            // This sets the country field ONLY on creation, not on subsequent upserts
            $setOnInsert: { country: "India" },

            // $inc: Increment popularity every time this city appears in a route.
            // If the city already exists → popularity goes up.
            // If it's a new insert → popularity starts at 1.
            $inc: { popularity: 1 },
        },
        {
            upsert: true,   // Create if not found
            new: true,      // Return the updated document
        }
    );

    // Cache is now stale — reload from DB and rebuild the Fuse index
    await initCityCache();
}

// ─────────────────────────────────────────────────────────────────────────────
// bulkUpsertCities(cities)
//
// Efficiently inserts many cities at once (used for seeding the DB from the
// cities.json file on server startup).
//
// Uses MongoDB bulkWrite with updateOne + upsert: true for each city.
// This is far more efficient than calling upsertCity() in a loop because
// it batches all operations into a single MongoDB round-trip.
//
// We rebuild the cache ONCE after the entire batch — not after each city.
// ─────────────────────────────────────────────────────────────────────────────
export async function bulkUpsertCities(cities) {
    if (!cities || cities.length === 0) return;

    // Build a bulkWrite operation for each city
    const ops = cities.map(({ name, state }) => ({
        updateOne: {
            filter: { name: toTitleCase(name), state: toTitleCase(state) },
            update: {
                $setOnInsert: { country: "India", popularity: 0 },
            },
            upsert: true,
        },
    }));

    await City.bulkWrite(ops, { ordered: false }); // ordered: false = don't stop on first error

    // Reload cache and rebuild index once after all inserts
    await initCityCache();
}
