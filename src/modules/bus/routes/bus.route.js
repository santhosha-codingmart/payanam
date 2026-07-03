import express from "express";
import {
    createBus,
    getVendorBuses,
    getBusById,
    updateBus,
    deleteBus,
    createRoute,
    getRoutesForBus,
    createSchedule,
    getScheduleSeats,
    searchBuses,
    blockSeats,
    addReview,
    cancelSchedule,
    getVendorSchedules,
} from "../controllers/bus.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
    createBusSchema,
    updateBusSchema,
    busIdParamSchema,
    createRouteSchema,
    createScheduleSchema,
    scheduleIdParamSchema,
    searchBusSchema,
    blockSeatsSchema,
    createReviewSchema,
} from "../validators/bus.validator.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Swagger tag definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Buses - Search
 *     description: Public bus search (no authentication required)
 *   - name: Buses - Seats
 *     description: View seat layout for a scheduled trip
 *   - name: Buses - CRUD
 *     description: Bus management (vendor/admin only)
 *   - name: Buses - Routes
 *     description: Route management with intermediate stops (vendor/admin only)
 *   - name: Buses - Schedules
 *     description: Trip schedule management (vendor/admin only)
 *   - name: Buses - Reviews
 *     description: Passenger reviews and ratings (any authenticated user)
 */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses/search:
 *   get:
 *     summary: Search buses between cities
 *     description: >
 *       Search for buses between any two cities. Supports **intermediate stop search** —
 *       if a route goes Chennai → Vellore → Bangalore, searching "Vellore to Bangalore" will find it.
 *       Returns boarding/dropping stop info and a calculated fare for partial routes.
 *     tags: [Buses - Search]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         example: Vellore
 *         description: Boarding city (can be source or an intermediate stop)
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         example: Bangalore
 *         description: Dropping city (can be destination or an intermediate stop)
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         example: "2026-06-25"
 *         description: Travel date (YYYY-MM-DD)
 *       - in: query
 *         name: busType
 *         schema:
 *           type: string
 *           enum: [AC_SLEEPER, NON_AC_SLEEPER, AC_SEATER, NON_AC_SEATER, VOLVO_AC, SEMI_SLEEPER, LUXURY_SLEEPER]
 *         description: Filter by bus type
 *       - in: query
 *         name: isAC
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter AC buses only
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum fare filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum fare filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price_low, price_high, rating, departure]
 *         description: Sort results
 *     responses:
 *       200:
 *         description: Search results with boarding/dropping stop info and calculated fares.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResultResponse'
 *       400:
 *         description: Missing or invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/search", validate(searchBusSchema), searchBuses);

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES (any logged-in user)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses/schedules/{scheduleId}/seats:
 *   get:
 *     summary: View seat layout for a schedule
 *     description: >
 *       Returns the full seat-by-seat layout for a specific scheduled trip,
 *       including each seat's booking status, fare, and passenger info.
 *     tags: [Buses - Seats]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the schedule
 *         example: "682abc1234567890abcd9999"
 *     responses:
 *       200:
 *         description: Seat layout with availability status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SeatLayoutResponse'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/schedules/:scheduleId/seats",
    validate(scheduleIdParamSchema),
    getScheduleSeats
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR-ONLY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses:
 *   post:
 *     summary: Create a new bus
 *     description: >
 *       Register a new bus with seat layout, amenities, and configuration.
 *       The seat layout defines individual seats that get copied into each schedule.
 *     tags: [Buses - CRUD]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBusRequest'
 *     responses:
 *       201:
 *         description: Bus created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate bus number or registration number
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    validate(createBusSchema),
    createBus
);

/**
 * @swagger
 * /api/v1/buses:
 *   get:
 *     summary: List all buses owned by the logged-in vendor
 *     tags: [Buses - CRUD]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of buses.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    getVendorBuses
);







/**
 * @swagger
 * /api/v1/buses/routes:
 *   post:
 *     summary: Create a route with intermediate stops
 *     description: >
 *       Create a route for a bus with an ordered list of stops.
 *       The `stops` array must include ALL cities (source + intermediates + destination) with order numbers.
 *       Set `farePerKm` to enable proportional fare calculation for partial routes
 *       (e.g., searching Vellore → Bangalore on a Chennai → Bangalore route will auto-calculate fare).
 *     tags: [Buses - Routes]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRouteRequest'
 *     responses:
 *       201:
 *         description: Route created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RouteResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Bus does not belong to this vendor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Bus not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(createRouteSchema),
    createRoute
);

/**
 * @swagger
 * /api/v1/buses/{id}/routes:
 *   get:
 *     summary: Get all routes for a specific bus
 *     tags: [Buses - Routes]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bus ObjectId
 *         example: "682abc1234567890abcd1234"
 *     responses:
 *       200:
 *         description: List of routes for the bus.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RouteListResponse'
 */
router.get(
    "/:id/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(busIdParamSchema),
    getRoutesForBus
);

/**
 * @swagger
 * /api/v1/buses/schedules:
 *   post:
 *     summary: Create a schedule (trip)
 *     description: >
 *       Create a scheduled trip for a bus on a specific date and route.
 *       The bus's seat layout is automatically copied into the schedule with all seats set to AVAILABLE.
 *       If cancellation policy is omitted, a default 4-tier policy is applied.
 *     tags: [Buses - Schedules]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateScheduleRequest'
 *     responses:
 *       201:
 *         description: Schedule created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleResponse'
 *       400:
 *         description: Validation error or route doesn't belong to bus
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Bus does not belong to this vendor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Bus or route not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate schedule (same bus + date + time)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/schedules",
    authenticate,
    authorize("vendor", "admin"),
    validate(createScheduleSchema),
    createSchedule
);

/**
 * @swagger
 * /api/v1/buses/schedules:
 *   get:
 *     summary: List all schedules for the logged-in vendor
 *     tags: [Buses - Schedules]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of schedules for the vendor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScheduleListResponse'
 */
router.get(
    "/schedules",
    authenticate,
    authorize("vendor", "admin"),
    getVendorSchedules
);

// ─────────────────────────────────────────────────────────────────────────────
// SEAT BLOCKING (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses/schedules/{scheduleId}/block-seats:
 *   post:
 *     summary: Temporarily block seats for booking
 *     description: Blocks seats in Redis for 10 minutes to prevent double booking.
 *     tags: [Buses - Seats]
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
 *     responses:
 *       200:
 *         description: Seats blocked successfully
 *       400:
 *         description: Invalid seats
 *       409:
 *         description: Seats already booked or blocked by another user
 */
router.post(
    "/schedules/:scheduleId/block-seats",
    authenticate,
    validate(blockSeatsSchema),
    blockSeats
);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE CANCEL (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses/schedules/{scheduleId}/cancel:
 *   patch:
 *     summary: Cancel a scheduled trip (vendor only)
 *     description: >
 *       Cancels an upcoming scheduled trip. All CONFIRMED bookings on this
 *       schedule are automatically cancelled with a **100% refund** (industry
 *       standard when the operator cancels — the passenger has no fault).
 *
 *       **Cannot cancel:**
 *       - A schedule already CANCELLED
 *       - A schedule marked COMPLETED
 *       - A schedule currently IN_TRANSIT
 *     tags: [Buses - Schedules]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the schedule to cancel
 *         example: "682abc1234567890abcd9999"
 *     responses:
 *       200:
 *         description: Schedule cancelled and bookings refunded.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Schedule cancelled. 5 booking(s) have been refunded in full."
 *               data:
 *                 scheduleId: "682abc1234567890abcd9999"
 *                 cancelledBookings: 5
 *       400:
 *         description: Schedule is already completed or in transit
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Schedule belongs to a different vendor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Schedule not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Schedule is already cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
    "/schedules/:scheduleId/cancel",
    authenticate,
    authorize("vendor", "admin"),
    validate(scheduleIdParamSchema),
    cancelSchedule
);


/**
 * @swagger
 * /api/v1/buses/{id}:
 *   get:
 *     summary: Get a specific bus by ID
 *     tags: [Buses - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bus ObjectId
 *         example: "682abc1234567890abcd1234"
 *     responses:
 *       200:
 *         description: Bus details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusResponse'
 *       404:
 *         description: Bus not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/:id",
    authenticate,
    validate(busIdParamSchema),
    getBusById
);

/**
 * @swagger
 * /api/v1/buses/{id}:
 *   patch:
 *     summary: Update a bus (owner only)
 *     description: Only the vendor who owns the bus can update it. Send only the fields you want to change.
 *     tags: [Buses - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bus ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBusRequest'
 *     responses:
 *       200:
 *         description: Bus updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BusResponse'
 *       403:
 *         description: Not the owner of this bus
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Bus not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate bus number or registration number
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(updateBusSchema),
    updateBus
);

/**
 * @swagger
 * /api/v1/buses/{id}:
 *   delete:
 *     summary: Delete a bus and all its routes & schedules
 *     description: >
 *       **Cascade delete** — removes the bus along with ALL associated routes and schedules.
 *       Only the owner vendor can delete.
 *     tags: [Buses - CRUD]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bus ObjectId
 *     responses:
 *       200:
 *         description: Bus deleted successfully.
 *       403:
 *         description: Not the owner of this bus
 *       404:
 *         description: Bus not found
 */
router.delete(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(busIdParamSchema),
    deleteBus
);

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS AND RATINGS (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/buses/{busId}/reviews:
 *   post:
 *     summary: Add a review for a bus
 *     description: Users can rate and review a bus after their completed journey.
 *     tags: [Buses - Reviews]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: busId
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
 *               review:
 *                 type: string
 *     responses:
 *       201:
 *         description: Review added successfully
 *       409:
 *         description: Duplicate review for this booking
 */
router.post(
    "/:busId/reviews",
    authenticate,
    validate(createReviewSchema),
    addReview
);

export default router;