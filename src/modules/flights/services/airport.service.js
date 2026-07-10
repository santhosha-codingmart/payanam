import Fuse from "fuse.js";
import { Airport } from "../models/airport.model.js";

let airportCache = [];
let fuseIndex = null;
const FUSE_OPTIONS = {
  keys: [
    {
      name: "iataCode",
      weight: 0.5,
    },
    {
      name: "city",
      weight: 0.3,
    },
    {
      name: "name",
      weight: 0.2,
    },
  ],
  includeScore: true,
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 1,
};

function buildFuseIndex() {
  fuseIndex = new Fuse(airportCache, FUSE_OPTIONS);
}

export async function initAirportCache() {
  const airports = await Airport.find(
    {},
    {
      _id: 0,
      __v: 0,
      createdAt: 0,
      updatedAt: 0,
    },
  )
    .sort({
      popularity: -1,
      city: 1,
    })
    .lean();
  airportCache = airports;
  buildFuseIndex();
  console.log(
    `✈️  Airport cache initialized: ${airportCache.length} airports loaded`,
  );
}

export function searchAirports(query) {
  const q = query.trim();
  if (!q) return [];
  if (!fuseIndex) return [];
  const results = fuseIndex.search(q);
  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (b.item.popularity !== a.item.popularity)
      return b.item.popularity - a.item.popularity;
    return a.item.iataCode.localeCompare(b.item.iataCode);
  });
  return results.slice(0, 10).map((r) => ({
    iataCode: r.item.iataCode,
    name: r.item.name,
    city: r.item.city,
    country: r.item.country,
    displayText: `${r.item.city} (${r.item.iataCode}) - ${r.item.name}`,
  }));
}

export async function bulkUpsertAirports(airports) {
  if (!airports || airports.length === 0) return;
  const ops = airports.map((airport) => ({
    updateOne: {
      filter: {
        iataCode: airport.iataCode.toUpperCase(),
      },
      update: {
        $setOnInsert: {
          name: airport.name,
          city: airport.city,
          country: airport.country || "India",
        },
        $inc: {
          popularity: 1,
        },
      },
      upsert: true,
    },
  }));
  await Airport.bulkWrite(ops, {
    ordered: false,
  });
  await initAirportCache();
}
