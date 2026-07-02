import express from "express";
import * as hotelController from "../controllers/hotel.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Hotels - Search
 *     description: Public hotel search
 *   - name: Hotels - Vendor
 *     description: Hotel and room management for vendors
 */

// ── PUBLIC ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/hotels/search:
 *   get:
 *     summary: Search hotels by city
 *     tags: [Hotels - Search]
 *     parameters:
 *       - in: query
 *         name: city
 *         required: true
 *         schema:
 *           type: string
 *         example: "Chennai"
 *       - in: query
 *         name: checkInDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOutDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: adults
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *       - in: query
 *         name: starRating
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [price_asc, price_desc, rating_desc]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of hotels with pagination
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean" }
 *                 message: { type: "string" }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/HotelItem" }
 */
router.get("/search", hotelController.searchHotels);

/**
 * @swagger
 * /api/v1/hotels/{id}:
 *   get:
 *     summary: Get details of a single hotel
 *     tags: [Hotels - Search]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hotel details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean" }
 *                 data: { $ref: "#/components/schemas/HotelItem" }
 */
router.get("/:id", hotelController.getHotelById);

/**
 * @swagger
 * /api/v1/hotels/{id}/details:
 *   get:
 *     summary: Get aggregated details (hotel + rooms + top reviews)
 *     tags: [Hotels - Search]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: checkInDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: checkOutDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: adults
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Aggregated hotel details
 */
router.get("/:id/details", hotelController.getHotelDetailsAggregated);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/rooms:
 *   get:
 *     summary: Get all rooms for a hotel
 *     tags: [Hotels - Search]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean" }
 *                 data:
 *                   type: array
 *                   items: { $ref: "#/components/schemas/RoomItem" }
 */
router.get("/:hotelId/rooms", hotelController.getHotelRooms);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/reviews:
 *   get:
 *     summary: Get reviews for a hotel
 *     tags: [Hotels - Reviews]
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of approved reviews
 */
router.get("/:hotelId/reviews", hotelController.getHotelReviews);

// ── USER BOOKING ───────────────────────────────────────────────────────────────

const userAuth = express.Router();
userAuth.use(authenticate);

/**
 * @swagger
 * /api/v1/hotels/bookings:
 *   post:
 *     summary: Create a hotel booking
 *     tags: [Hotels - Bookings]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateHotelBookingRequest"
 *     responses:
 *       201:
 *         description: Booking confirmed
 */
userAuth.post("/bookings", hotelController.createBooking);

/**
 * @swagger
 * /api/v1/hotels/bookings/my-bookings:
 *   get:
 *     summary: Get my hotel bookings
 *     tags: [Hotels - Bookings]
 *     security:
 *       - cookieAuth: []
 */
userAuth.get("/bookings/my-bookings", hotelController.getUserBookings);

/**
 * @swagger
 * /api/v1/hotels/bookings/{bookingId}/cancel:
 *   put:
 *     summary: Cancel a hotel booking
 *     tags: [Hotels - Bookings]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
userAuth.put("/bookings/:bookingId/cancel", hotelController.cancelBooking);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/reviews:
 *   post:
 *     summary: Add a review for a hotel
 *     tags: [Hotels - Reviews]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateHotelReviewRequest"
 *     responses:
 *       201:
 *         description: Review added successfully
 */
userAuth.post("/:hotelId/reviews", hotelController.addHotelReview);

router.use("/", userAuth);

// ── VENDOR ONLY ──────────────────────────────────────────────────────────────

const vendorAuth = express.Router();
vendorAuth.use(authenticate);
vendorAuth.use(authorize("vendor", "admin"));

/**
 * @swagger
 * /api/v1/hotels:
 *   post:
 *     summary: Create a new hotel
 *     tags: [Hotels - Vendor]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateHotelRequest"
 *     responses:
 *       201:
 *         description: Hotel created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean" }
 *                 data: { $ref: "#/components/schemas/HotelItem" }
 */
vendorAuth.post("/", hotelController.createHotel);

/**
 * @swagger
 * /api/v1/hotels:
 *   get:
 *     summary: Get all hotels owned by the logged-in vendor
 *     tags: [Hotels - Vendor]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: List of vendor's hotels
 */
vendorAuth.get("/", hotelController.getVendorHotels);

/**
 * @swagger
 * /api/v1/hotels/{id}:
 *   put:
 *     summary: Update an existing hotel
 *     tags: [Hotels - Vendor]
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
 *             type: object
 *             properties:
 *               status: { type: string, example: "INACTIVE" }
 *     responses:
 *       200:
 *         description: Hotel updated successfully
 */
vendorAuth.put("/:id", hotelController.updateHotel);

/**
 * @swagger
 * /api/v1/hotels/{hotelId}/rooms:
 *   post:
 *     summary: Add a room type to a hotel
 *     tags: [Hotels - Vendor]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: hotelId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/CreateRoomRequest"
 *     responses:
 *       201:
 *         description: Room added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: "boolean" }
 *                 data: { $ref: "#/components/schemas/RoomItem" }
 */
vendorAuth.post("/:hotelId/rooms", hotelController.createRoom);

router.use("/", vendorAuth);

export default router;
