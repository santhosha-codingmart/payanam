// ─────────────────────────────────────────────────────────────────────────────
// Place Controller — HTTP layer only
//
// This controller's only job is to:
//   1. Extract query params from the request
//   2. Call the service
//   3. Send the HTTP response
//
// No business logic lives here. All logic is in city.service.js.
// ─────────────────────────────────────────────────────────────────────────────

import { searchCities } from "../services/city.service.js";

/**
 * GET /api/v1/places/search?q=che
 *
 * Returns up to 10 fuzzy-matched city suggestions for the given query.
 * No authentication required — this is a public typeahead API.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const searchPlaces = (req, res) => {
    try {
        const query = req.query.q || "";

        // Delegate entirely to the service — controller stays thin
        const results = searchCities(query);

        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("Place search error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search places",
        });
    }
};
