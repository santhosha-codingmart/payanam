import { searchAirports } from "../services/airport.service.js";

/**
 * GET /api/v1/airports/search?q=del
 *
 * Returns up to 10 fuzzy-matched airport suggestions for the given query.
 * No authentication required — public typeahead API.
 */
export const searchAirportsController = (req, res) => {
    try {
        const query = req.query.q || "";
        const results = searchAirports(query);

        return res.status(200).json({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error("Airport search error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to search airports",
        });
    }
};
