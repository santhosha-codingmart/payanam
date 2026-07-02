// ─────────────────────────────────────────────────────────────────────────────
// Flight Routes — URL definitions with Swagger documentation
// Maps HTTP method + path → middleware chain → controller function
//
// Middleware execution order for protected routes:
//   authenticate → authorize → validate(schema) → controller
//   ↑ JWT check    ↑ role check  ↑ Zod validation  ↑ business logic
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import {
    createFlight,
    getVendorFlights,
    getFlightById,
    updateFlight,
    deleteFlight,
    createFlightRoute,
    getRoutesForFlight,
    createFlightSchedule,
    getFlightScheduleSeats,
    searchFlights,
    blockSeats,
    cancelFlightSchedule,
    addFlightReview,
    getVendorFlightSchedules,
} from "../controllers/flight.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
    createFlightSchema,
    updateFlightSchema,
    flightIdParamSchema,
    createFlightRouteSchema,
    createFlightScheduleSchema,
    scheduleIdParamSchema,
    searchFlightSchema,
    blockSeatsSchema,
    createFlightReviewSchema,
} from "../validators/flight.validator.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Swagger Tag Definitions
// These group the routes into sections in the Swagger UI.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Flights - Search
 *     description: Public flight search (no authentication required)
 *   - name: Flights - Seats
 *     description: View and block seats for a scheduled flight
 *   - name: Flights - CRUD
 *     description: Aircraft management (vendor/admin only)
 *   - name: Flights - Routes
 *     description: Route management with airport stops (vendor/admin only)
 *   - name: Flights - Schedules
 *     description: Flight schedule management (vendor/admin only)
 *   - name: Flights - Reviews
 *     description: Passenger reviews and ratings (any authenticated user)
 */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no authentication required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/search:
 *   get:
 *     summary: Search flights between two locations
 *     description: >
 *       Search for available flights between any two airports or cities.
 *       Supports **IATA code search** (e.g., "DEL", "BOM") and **city name search** (e.g., "Delhi", "Mumbai").
 *       Also supports **layover route search** — if a flight goes DEL → BOM → GOA,
 *       searching "BOM to GOA" will find it.
 *     tags: [Flights - Search]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         example: DEL
 *         description: Departure city name or IATA code
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         example: BOM
 *         description: Arrival city name or IATA code
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         example: "2026-07-10"
 *         description: Travel date (YYYY-MM-DD)
 *       - in: query
 *         name: aircraftType
 *         schema:
 *           type: string
 *           enum: [AIRBUS_A320, AIRBUS_A321, BOEING_737, BOEING_777, BOEING_787, ATR_72, EMBRAER_E175]
 *         description: Filter by aircraft type
 *       - in: query
 *         name: hasBusinessClass
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter flights with business class
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum fare filter (in INR)
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum fare filter (in INR)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price_low, price_high, rating, duration, departure]
 *         description: Sort results
 *     responses:
 *       200:
 *         description: List of matching flights with journey and pricing details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightSearchResultResponse'
 *       400:
 *         description: Missing or invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/search", validate(searchFlightSchema), searchFlights);

// ─────────────────────────────────────────────────────────────────────────────
// SEAT LAYOUT (authenticated users only — no vendor role required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/schedules/{scheduleId}/seats:
 *   get:
 *     summary: View seat layout for a scheduled flight
 *     description: >
 *       Returns the full seat-by-seat layout for a specific scheduled trip,
 *       including each seat's booking status, cabin class, fare, and passenger info.
 *       The `seats` array is excluded from search results to keep payloads small —
 *       call this endpoint only when the user clicks into a specific flight.
 *     tags: [Flights - Seats]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the flight schedule
 *         example: "682abc1234567890abcd9999"
 *     responses:
 *       200:
 *         description: Full seat layout with per-seat availability status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightSeatLayoutResponse'
 *       404:
 *         description: Schedule not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/schedules/:scheduleId/seats",
    validate(scheduleIdParamSchema),
    getFlightScheduleSeats
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR-ONLY ROUTES — Aircraft CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights:
 *   post:
 *     summary: Register a new aircraft
 *     description: >
 *       Create a new aircraft with its seat layout, cabin configuration, and amenities.
 *       The seat layout is used as a template — it gets copied into every FlightSchedule
 *       created for this aircraft, creating independent per-trip seat snapshots.
 *     tags: [Flights - CRUD]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlightRequest'
 *     responses:
 *       201:
 *         description: Aircraft registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightResponse'
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate flight number or registration number.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    validate(createFlightSchema),
    createFlight
);

/**
 * @swagger
 * /api/v1/flights:
 *   get:
 *     summary: List all aircraft owned by the logged-in vendor
 *     tags: [Flights - CRUD]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of aircraft.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightListResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    getVendorFlights
);

/**
 * @swagger
 * /api/v1/flights/{id}:
 *   get:
 *     summary: Get a specific aircraft by ID
 *     tags: [Flights - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Aircraft ObjectId
 *     responses:
 *       200:
 *         description: Aircraft details.
 *       404:
 *         description: Flight not found.
 */
router.get(
    "/:id",
    authenticate,
    validate(flightIdParamSchema),
    getFlightById
);

/**
 * @swagger
 * /api/v1/flights/{id}:
 *   patch:
 *     summary: Update an aircraft (owner only)
 *     description: Only the vendor who registered the aircraft can update it. Send only the fields you want to change.
 *     tags: [Flights - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateFlightRequest'
 *     responses:
 *       200:
 *         description: Aircraft updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightResponse'
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Flight not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate flight number or registration number.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(updateFlightSchema),
    updateFlight
);

/**
 * @swagger
 * /api/v1/flights/{id}:
 *   delete:
 *     summary: Delete an aircraft and all its routes & schedules
 *     description: >
 *       **Cascade delete** — removes the aircraft along with ALL associated
 *       routes and schedules. Only the owner vendor can delete.
 *     tags: [Flights - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aircraft deleted successfully.
 *       403:
 *         description: Not the owner.
 *       404:
 *         description: Flight not found.
 */
router.delete(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(flightIdParamSchema),
    deleteFlight
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR-ONLY ROUTES — Flight Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/routes:
 *   post:
 *     summary: Create a route with airport stops
 *     description: >
 *       Create a route for an aircraft with an ordered list of airport stops.
 *       The `stops` array must include ALL airports (departure + layovers + arrival)
 *       with sequential `order` numbers. Order is used to enforce travel direction —
 *       prevents a DEL→BOM route from showing up in BOM→DEL searches.
 *     tags: [Flights - Routes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlightRouteRequest'
 *     responses:
 *       201:
 *         description: Route created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightRouteResponse'
 *       403:
 *         description: Aircraft does not belong to this vendor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Flight not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(createFlightRouteSchema),
    createFlightRoute
);

/**
 * @swagger
 * /api/v1/flights/{id}/routes:
 *   get:
 *     summary: Get all routes for a specific aircraft
 *     tags: [Flights - Routes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Aircraft ObjectId
 *     responses:
 *       200:
 *         description: List of routes.
 */
router.get(
    "/:id/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(flightIdParamSchema),
    getRoutesForFlight
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR-ONLY ROUTES — Flight Schedules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/schedules:
 *   post:
 *     summary: Schedule a flight trip
 *     description: >
 *       Create a scheduled trip for an aircraft on a specific date and route.
 *       The aircraft's seat layout is automatically copied into the schedule with
 *       all seats set to AVAILABLE. A default 4-tier cancellation policy is applied
 *       if none is provided.
 *     tags: [Flights - Schedules]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlightScheduleRequest'
 *     responses:
 *       201:
 *         description: Schedule created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightScheduleResponse'
 *       400:
 *         description: Validation error or route doesn't belong to aircraft.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate schedule (same aircraft + date + time).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/schedules",
    authenticate,
    authorize("vendor", "admin"),
    validate(createFlightScheduleSchema),
    createFlightSchedule
);

/**
 * @swagger
 * /api/v1/flights/schedules:
 *   get:
 *     summary: List all flight schedules for the logged-in vendor
 *     tags: [Flights - Schedules]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of flight schedules.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleListResponse'
 */
router.get(
    "/schedules",
    authenticate,
    authorize("vendor", "admin"),
    getVendorFlightSchedules
);

// ─────────────────────────────────────────────────────────────────────────────
// SEAT BLOCKING — for logged-in passengers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/schedules/{scheduleId}/block-seats:
 *   post:
 *     summary: Temporarily block seats for booking
 *     description: >
 *       Locks the specified seats in Redis for **10 minutes** to prevent
 *       double-booking while the user completes payment. If payment isn't
 *       completed in time, the lock expires and seats revert to AVAILABLE.
 *     tags: [Flights - Seats]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               seatNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["3A", "3B"]
 *     responses:
 *       200:
 *         description: Seats blocked successfully for 10 minutes.
 *       400:
 *         description: Seat does not exist.
 *       409:
 *         description: Seat already booked or blocked by another user.
 */
router.post(
    "/schedules/:scheduleId/block-seats",
    authenticate,
    validate(blockSeatsSchema),
    blockSeats
);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE CANCEL — Vendor-only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/schedules/{scheduleId}/cancel:
 *   patch:
 *     summary: Cancel a scheduled flight (vendor only)
 *     description: >
 *       Cancels an upcoming scheduled flight. All CONFIRMED bookings on this
 *       schedule are automatically cancelled with a **100% refund** — industry
 *       standard when the airline cancels (passenger has zero fault).
 *
 *       **Cannot cancel:**
 *       - A schedule already CANCELLED
 *       - A schedule marked COMPLETED
 *       - A schedule with status DEPARTED
 *     tags: [Flights - Schedules]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the schedule to cancel
 *     responses:
 *       200:
 *         description: Schedule cancelled and all bookings refunded.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Schedule cancelled. 3 booking(s) have been refunded in full."
 *               data:
 *                 scheduleId: "682abc1234567890abcd9999"
 *                 cancelledBookings: 3
 *       400:
 *         description: Schedule already departed or completed.
 *       403:
 *         description: Schedule belongs to a different vendor.
 *       404:
 *         description: Schedule not found.
 *       409:
 *         description: Schedule is already cancelled.
 */
router.patch(
    "/schedules/:scheduleId/cancel",
    authenticate,
    authorize("vendor", "admin"),
    validate(scheduleIdParamSchema),
    cancelFlightSchedule
);

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS AND RATINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/flights/{flightId}/reviews:
 *   post:
 *     summary: Add a review for a flight
 *     description: Passengers can rate and review a flight after their completed journey. One review per booking.
 *     tags: [Flights - Reviews]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: flightId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *                 minLength: 10
 *     responses:
 *       201:
 *         description: Review added successfully.
 *       409:
 *         description: Duplicate review for this booking.
 */
router.post(
    "/:flightId/reviews",
    authenticate,
    validate(createFlightReviewSchema),
    addFlightReview
);

export default router;
