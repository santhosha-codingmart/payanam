import express from "express";
import { searchAirportsController } from "../controllers/airport.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Flights - Airports
 *     description: Search and autocomplete for airports
 */

/**
 * @swagger
 * /api/v1/airports/search:
 *   get:
 *     summary: Search for an airport with fuzzy matching
 *     description: >
 *       Returns up to 10 airport suggestions for a given query string.
 *
 *       **Fuzzy matching** is enabled for:
 *       - IATA Code (e.g. "DEL")
 *       - City (e.g. "Delhi")
 *       - Airport Name (e.g. "Indira Gandhi")
 *
 *       Results are sorted by Fuse score, then popularity, then alphabetical order.
 *     tags: [Flights - Airports]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         example: "del"
 *         description: Search query string (IATA code, city, or airport name)
 *     responses:
 *       200:
 *         description: List of matching airport suggestions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AirportSearchResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/search", searchAirportsController);

export default router;
