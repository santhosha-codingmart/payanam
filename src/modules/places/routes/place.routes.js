// ─────────────────────────────────────────────────────────────────────────────
// Place Routes — /api/v1/places
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import { searchPlaces } from "../controllers/place.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Places - Search
 *     description: Search and autocomplete for cities and places
 */

/**
 * @swagger
 * /api/v1/places/search:
 *   get:
 *     summary: Search for a city with fuzzy matching
 *     description: >
 *       Returns up to 10 city suggestions for a given query string.
 *
 *       **Fuzzy matching** is enabled — typos are handled gracefully:
 *       - `"cheni"` → `"Chennai"`
 *       - `"mumbay"` → `"Mumbai"`
 *       - `"bangalor"` → `"Bangalore"`
 *
 *       Results are sorted by:
 *       1. Fuse.js similarity score (closest match first)
 *       2. Popularity (major hubs before smaller cities)
 *       3. Alphabetical order (stable tiebreaker)
 *
 *       **Performance:** Runs entirely in-memory using a pre-built Fuse.js index.
 *       Zero database queries per keystroke.
 *     tags: [Places - Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         example: "che"
 *         description: Search query string (city name, possibly with typos)
 *     responses:
 *       200:
 *         description: List of matching city suggestions (empty array if q is blank)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   maxItems: 10
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "Chennai"
 *                       state:
 *                         type: string
 *                         example: "Tamil Nadu"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/search", searchPlaces);

export default router;
