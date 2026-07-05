// =============================================================================
// Payment Routes — Wires HTTP endpoints to payment controllers
//
// Base path: /api/v1/payments (mounted in app.js)
//
// Endpoints:
//   POST /create-order   → Create Razorpay order (Step 1 of payment flow)
//   POST /verify         → Verify signature + confirm booking (Step 2)
//   POST /failure        → Log payment failure
//   GET  /status/:id     → Poll for payment/booking status
// =============================================================================

import express from "express";
import {
    createOrder,
    verifyPayment,
    paymentFailure,
    getStatus,
} from "../controllers/payment.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: |
 *       Razorpay payment integration — create orders, verify payments, and handle failures.
 *
 *       **Full Flow:**
 *       1. `POST /api/v1/bookings` → creates a PENDING booking, returns `data._id` (bookingMongoId)
 *       2. `POST /api/v1/payments/create-order` → creates Razorpay order, returns `razorpayOrderId` + `amount`
 *       3. Frontend opens Razorpay checkout modal using `razorpayOrderId`
 *       4. User pays → Razorpay returns `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
 *       5. `POST /api/v1/payments/verify` → verifies signature, confirms booking
 *       6. If payment fails → `POST /api/v1/payments/failure` to log it (booking stays PENDING, user can retry)
 */

// =============================================================================
// POST /api/v1/payments/create-order
// =============================================================================
/**
 * @swagger
 * /api/v1/payments/create-order:
 *   post:
 *     summary: Create a Razorpay payment order (Step 1)
 *     description: |
 *       **Step 1 of the payment flow.**
 *
 *       Prerequisites:
 *       - User must be authenticated
 *       - A booking must already exist in PENDING state (created via `POST /api/v1/bookings`)
 *       - Pass the MongoDB `_id` of that booking as `bookingMongoId` (NOT the human-readable `PAY-XXXXXX`)
 *
 *       This creates a Razorpay "order" and returns the `razorpayOrderId` + `amount` that the
 *       frontend needs to open the Razorpay checkout modal.
 *
 *       **Idempotent:** If a CREATED payment already exists for this booking
 *       (e.g. page refresh), the existing order is returned without creating a duplicate.
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *           example:
 *             bookingMongoId: "6687a3c9f3b2e4d5c6a7b8c9"
 *     responses:
 *       201:
 *         description: Razorpay order created. Use `razorpayOrderId` and `amount` to open the checkout modal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateOrderResponse'
 *       401:
 *         description: Not authenticated — login required.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Booking does not belong to this user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Booking is already paid and confirmed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "This booking has already been paid for."
 */
router.post("/create-order", authenticate, createOrder);

// =============================================================================
// POST /api/v1/payments/verify
// =============================================================================
/**
 * @swagger
 * /api/v1/payments/verify:
 *   post:
 *     summary: Verify Razorpay signature and confirm booking (Step 2)
 *     description: |
 *       **Step 2 of the payment flow — the most important step.**
 *
 *       After the user completes payment in the Razorpay checkout modal, the frontend
 *       `handler` callback receives three values from Razorpay:
 *       - `razorpay_order_id`
 *       - `razorpay_payment_id`
 *       - `razorpay_signature`
 *
 *       The frontend must forward all three — plus `bookingMongoId` — to this endpoint.
 *
 *       **What happens server-side:**
 *       1. Recomputes `HMAC-SHA256(orderId + "|" + paymentId, KEY_SECRET)`
 *       2. If it matches the provided signature → payment is genuine
 *       3. Booking status → `CONFIRMED`, payment status → `SUCCESS`
 *       4. Redis seat locks are released
 *       5. Returns the confirmed booking + payment record
 *
 *       **Security note:** Never skip signature verification. This prevents a user
 *       from forging a payment by replaying another order's IDs.
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyPaymentRequest'
 *           example:
 *             razorpayOrderId: "order_PQ5rT7xZaK3mNL"
 *             razorpayPaymentId: "pay_R2sT5xZaK3mNL9P"
 *             razorpaySignature: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
 *             bookingMongoId: "6687a3c9f3b2e4d5c6a7b8c9"
 *     responses:
 *       200:
 *         description: Payment verified. Booking confirmed. Returns full booking + payment details.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyPaymentResponse'
 *       400:
 *         description: Invalid signature — payment verification failed (possible tampering).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Payment verification failed. Invalid signature."
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Booking does not belong to this user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No payment record found for this order ID, or booking not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Payment already verified (duplicate request).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "This payment has already been verified."
 */
router.post("/verify", authenticate, verifyPayment);

// =============================================================================
// POST /api/v1/payments/failure
// =============================================================================
/**
 * @swagger
 * /api/v1/payments/failure:
 *   post:
 *     summary: Log a payment failure
 *     description: |
 *       Called by the frontend when the Razorpay checkout fails — e.g. when:
 *       - The user closes the modal without paying (`ondismiss`)
 *       - The card is declined
 *       - A network error occurs
 *       - The `payment.failed` event fires
 *
 *       The booking remains in `PENDING` state so the user can retry payment.
 *       This endpoint simply logs the failure for analytics/support and marks
 *       the Payment document as `FAILED`.
 *
 *       **This endpoint is non-critical** — if it fails, the user experience
 *       is not affected. Call it fire-and-forget.
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentFailureRequest'
 *           example:
 *             razorpayOrderId: "order_PQ5rT7xZaK3mNL"
 *             errorCode: "BAD_REQUEST_ERROR"
 *             errorDescription: "Payment cancelled by user"
 *             bookingMongoId: "6687a3c9f3b2e4d5c6a7b8c9"
 *     responses:
 *       200:
 *         description: Failure logged. User can retry payment.
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Payment failure recorded. You can retry payment from your booking page."
 *               data:
 *                 bookingMongoId: "6687a3c9f3b2e4d5c6a7b8c9"
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/failure", authenticate, paymentFailure);

// =============================================================================
// GET /api/v1/payments/status/:bookingMongoId
// =============================================================================
/**
 * @swagger
 * /api/v1/payments/status/{bookingMongoId}:
 *   get:
 *     summary: Get payment and booking status
 *     description: |
 *       Returns the current payment status alongside the booking's `bookingStatus`
 *       and `paymentStatus` fields.
 *
 *       **Use cases:**
 *       - Poll for confirmation after Razorpay checkout (e.g. every 2s for up to 30s)
 *       - Display payment details on the booking confirmation page
 *       - Check if a retry is needed after a failed payment
 *
 *       The `payment` field is `null` if no payment attempt has been made yet
 *       (booking was just created but the user hasn't opened checkout).
 *     tags: [Payments]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingMongoId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB `_id` of the Booking document (NOT the human-readable PAY-XXXXXX bookingId)
 *         example: "6687a3c9f3b2e4d5c6a7b8c9"
 *     responses:
 *       200:
 *         description: Current payment and booking status.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentStatusResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Booking does not belong to this user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Booking not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/status/:bookingMongoId", authenticate, getStatus);

export default router;
