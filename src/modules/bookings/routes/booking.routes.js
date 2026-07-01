// =============================================================================
// Booking Routes — Wires HTTP endpoints to controllers
//
// HOW EXPRESS ROUTING WORKS:
//   1. app.js mounts this router at "/api/v1/bookings"
//   2. Any request to e.g. POST /api/v1/bookings runs through:
//      authenticate → validate → createBooking controller
//   3. Each middleware in the chain calls next() to hand off to the next one
//
// MIDDLEWARE ORDER (critical!):
//   authenticate must run BEFORE validate and the controller,
//   because validate schemas may reference req.user and the controller
//   ALWAYS needs req.user to be populated.
// =============================================================================

import express from "express";
import {
    createBooking,
    getBookingById,
    getMyBookings,
    getVendorBookings,
    cancelBooking,
} from "../controllers/booking.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
    createBookingSchema,
    cancelBookingSchema,
    getBookingSchema,
} from "../validations/booking.validator.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Bookings
 *     description: Bus ticket booking, viewing, and cancellation
 */

// =============================================================================
// POST /api/v1/bookings
// =============================================================================
/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a confirmed booking
 *     description: >
 *       **Full booking flow:**
 *       
 *       1. User must have already called `POST /schedules/:scheduleId/block-seats`
 *       2. This endpoint verifies the Redis seat lock (10-min window)
 *       3. Creates a Booking document (PENDING → CONFIRMED)
 *       4. Marks seats as BOOKED in the Schedule
 *       5. Releases the Redis lock
 *       6. Simulates payment success (mock)
 *       
 *       Returns full ticket details including a unique PNR (e.g. `PAY-A3F2B1`).
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingRequest'
 *           example:
 *             scheduleId: "665f1a2b3c4d5e6f7a8b9c0d"
 *             boardingPointId: "665f1a2b3c4d5e6f7a8b0001"
 *             droppingPointId: "665f1a2b3c4d5e6f7a8b0002"
 *             passengerDetails:
 *               - seatNumber: "L1"
 *                 name: "Santhosh Kumar"
 *                 age: 28
 *                 gender: "male"
 *               - seatNumber: "L2"
 *                 name: "Priya Rajan"
 *                 age: 26
 *                 gender: "female"
 *     responses:
 *       201:
 *         description: Booking confirmed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingResponse'
 *       400:
 *         description: Validation error or seat count mismatch
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
 *       409:
 *         description: Seat lock expired or already booked by another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, validate(createBookingSchema), createBooking);

// =============================================================================
// GET /api/v1/bookings/my-bookings
// NOTE: This route MUST be defined BEFORE /:bookingId to avoid Express treating
// "my-bookings" as a bookingId parameter.
// =============================================================================
/**
 * @swagger
 * /api/v1/bookings/my-bookings:
 *   get:
 *     summary: Get all bookings for the logged-in user
 *     description: >
 *       Returns a summarized list of all the user's bookings (past and upcoming),
 *       sorted by most recent first. Used for the "My Trips" page.
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of bookings.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingListResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/my-bookings", authenticate, getMyBookings);

// =============================================================================
// GET /api/v1/bookings/vendor-bookings
// NOTE: Must be defined BEFORE /:bookingId so Express doesn't treat
// "vendor-bookings" as a bookingId param.
// =============================================================================
/**
 * @swagger
 * /api/v1/bookings/vendor-bookings:
 *   get:
 *     summary: Get all bookings on the vendor's buses
 *     description: >
 *       Returns a paginated list of all bookings made on buses owned by the
 *       authenticated vendor. The vendor's `userId` is matched against the
 *       `operatorId` field stored on every booking at creation time.
 *
 *       **Filters (all optional):**
 *       - `status` — filter by booking status (`CONFIRMED`, `CANCELLED`, `PENDING`)
 *       - `scheduleId` — filter to a single trip (view passenger manifest)
 *       - `page` — page number (default: 1)
 *       - `limit` — results per page (default: 20, max: 100)
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [CONFIRMED, CANCELLED, PENDING]
 *         description: Filter by booking status
 *       - in: query
 *         name: scheduleId
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of a specific schedule (trip)
 *         example: "665f1a2b3c4d5e6f7a8b9c0d"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of results per page
 *     responses:
 *       200:
 *         description: List of bookings with pagination metadata.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - bookingId: "PAY-A3F2B1"
 *                   bookingStatus: "CONFIRMED"
 *                   paymentStatus: "SUCCESS"
 *                   totalFare: 875
 *                   bookedSeats: ["L1", "L2"]
 *                   bookedAt: "2026-06-30T08:45:00.000Z"
 *                   userId:
 *                     name: "Santhosh Kumar"
 *                     email: "santhosh@example.com"
 *                     phoneNo: "+919876543210"
 *               pagination:
 *                 totalCount: 142
 *                 totalPages: 8
 *                 currentPage: 1
 *                 limit: 20
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Access denied — vendor role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Access denied. This action requires one of the following roles: vendor."
 */
router.get("/vendor-bookings", authenticate, authorize("vendor"), getVendorBookings);

// =============================================================================
// GET /api/v1/bookings/:bookingId
// =============================================================================
/**
 * @swagger
 * /api/v1/bookings/{bookingId}:
 *   get:
 *     summary: Get full ticket details for a booking
 *     description: >
 *       Returns the complete booking with populated bus, route, and schedule details.
 *       Only the booking owner can access this endpoint.
 *       
 *       **bookingId** is the human-readable PNR string like `PAY-A3F2B1`, NOT the MongoDB `_id`.
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: "PAY-A3F2B1"
 *         description: Human-readable PNR / booking reference
 *     responses:
 *       200:
 *         description: Full ticket details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingDetailResponse'
 *       403:
 *         description: Booking belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
    "/:bookingId",
    authenticate,
    validate(getBookingSchema),
    getBookingById
);

// =============================================================================
// POST /api/v1/bookings/:bookingId/cancel
// =============================================================================
/**
 * @swagger
 * /api/v1/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel a booking and process refund
 *     description: >
 *       Cancels a CONFIRMED booking. Refund amount is calculated based on
 *       how many hours remain before departure using the cancellation policy
 *       that was snapshotted at booking time.
 *       
 *       **Refund tiers (example):**
 *       - Cancel 48h+ before departure → 100% refund
 *       - Cancel 24h-48h before → 75% refund
 *       - Cancel 12h-24h before → 50% refund
 *       - Cancel 0h-12h before → 0% refund
 *     tags: [Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: "PAY-A3F2B1"
 *     responses:
 *       200:
 *         description: Booking cancelled. Returns refund amount.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CancellationResponse'
 *       400:
 *         description: Booking is not in a cancellable state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Booking belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Booking already cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
    "/:bookingId/cancel",
    authenticate,
    validate(cancelBookingSchema),
    cancelBooking
);

export default router;
