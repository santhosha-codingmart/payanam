import Fuse from "fuse.js";
import { City } from "../models/city.model.js";

let cityCache = [];
let fuseIndex = null;
const FUSE_OPTIONS = {
  keys: ["name"],
  includeScore: true,
  threshold: 0.4,
  distance: 100,
  minMatchCharLength: 1,
};

function buildFuseIndex() {
  fuseIndex = new Fuse(cityCache, FUSE_OPTIONS);
}

export async function initCityCache() {
  const cities = await City.find(
    {},
    {
      name: 1,
      state: 1,
      popularity: 1,
      _id: 0,
    },
  )
    .sort({
      popularity: -1,
      name: 1,
    })
    .lean();
  cityCache = cities;
  buildFuseIndex();
  console.log(`✅ City cache initialized: ${cityCache.length} cities loaded`);
}

export function searchCities(query) {
  const q = query.trim();
  if (!q) return [];
  if (!fuseIndex) return [];
  const results = fuseIndex.search(q);
  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (b.item.popularity !== a.item.popularity)
      return b.item.popularity - a.item.popularity;
    return a.item.name.localeCompare(b.item.name);
  });
  return results.slice(0, 10).map((r) => ({
    name: r.item.name,
    state: r.item.state,
  }));
}

function toTitleCase(str) {
  return str
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function upsertCity(name, state) {
  const normalizedName = toTitleCase(name);
  const normalizedState = toTitleCase(state);
  await City.findOneAndUpdate(
    {
      name: normalizedName,
      state: normalizedState,
    },
    {
      $setOnInsert: {
        country: "India",
      },
      $inc: {
        popularity: 1,
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
  await initCityCache();
}

export async function bulkUpsertCities(cities) {
  if (!cities || cities.length === 0) return;
  const ops = cities.map(({ name, state }) => ({
    updateOne: {
      filter: {
        name: toTitleCase(name),
        state: toTitleCase(state),
      },
      update: {
        $setOnInsert: {
          country: "India",
          popularity: 0,
        },
      },
      upsert: true,
    },
  }));
  await City.bulkWrite(ops, {
    ordered: false,
  });
  await initCityCache();
}
