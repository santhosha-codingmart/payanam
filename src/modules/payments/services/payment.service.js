// =============================================================================
// Payment Service — All Razorpay integration logic
//
// WHY A DEDICATED SERVICE:
//   Isolates all payment-gateway code (Razorpay SDK calls, signature
//   verification, refund initiation) from the controller and the booking
//   service. If we ever swap Razorpay for Stripe, only this file changes.
//
// FULL RAZORPAY FLOW (read this before editing anything):
//
//   ┌────────────────────────────────────────────────────────┐
//   │ 1. BACKEND  createRazorpayOrder()                       │
//   │    → Razorpay returns orderId ("order_xxx")             │
//   │    → We create a Payment doc (status: CREATED)          │
//   │    → Return orderId + amount to frontend                │
//   ├────────────────────────────────────────────────────────┤
//   │ 2. FRONTEND opens Razorpay checkout modal               │
//   │    → User pays (UPI / card / netbanking)               │
//   │    → Razorpay calls frontend handler with:              │
//   │        razorpay_order_id                               │
//   │        razorpay_payment_id                             │
//   │        razorpay_signature                              │
//   ├────────────────────────────────────────────────────────┤
//   │ 3. FRONTEND sends all 3 IDs + bookingMongoId to:        │
//   │    POST /api/v1/payments/verify                         │
//   ├────────────────────────────────────────────────────────┤
//   │ 4. BACKEND verifyPayment()                              │
//   │    → Verify HMAC-SHA256 signature (tamper detection)    │
//   │    → Update Payment doc (status: SUCCESS)              │
//   │    → Update Booking doc (status: CONFIRMED)             │
//   │    → Mark schedule seats as BOOKED                      │
//   │    → Release Redis seat locks                          │
//   └────────────────────────────────────────────────────────┘
//
// SECURITY NOTE — Why we verify the signature server-side:
//   Razorpay sends the signature to the frontend, but a malicious user
//   could intercept and forge the payment data. The signature is a
//   HMAC-SHA256 hash of (orderId + "|" + paymentId) keyed with your
//   KEY_SECRET. Only someone with your secret can produce a valid signature.
//   We NEVER trust the frontend to confirm a payment — we always verify.
// =============================================================================

import Razorpay from "razorpay";
import crypto from "crypto";
import mongoose from "mongoose";
import Payment from "../models/payment.model.js";
import Booking from "../../bookings/models/booking.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import redis from "../../../config/redis.js";
import { ApiError } from "../../../utils/ApiError.js";
import { sendBookingConfirmationEmail } from "../../../utils/email.service.js";
import { generateTicketPDF } from "../../../utils/ticket.pdf.service.js";
import logger from "../../../config/logger.js";

// ── Razorpay client (singleton) ───────────────────────────────────────────────
// Initialised once at module load. key_id and key_secret come from .env.
// Test credentials start with "rzp_test_"; live credentials start with "rzp_live_".
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// =============================================================================
// STEP 1 — CREATE RAZORPAY ORDER
// =============================================================================
//
// Called from: POST /api/v1/payments/create-order
//
// What this does:
//   1. Validates the booking exists and belongs to the requesting user
//   2. Ensures the booking hasn't already been paid for
//   3. Creates a Razorpay order (an "intent to pay" record on Razorpay's servers)
//   4. Creates a Payment document in our DB (status: CREATED) for audit trail
//   5. Returns the razorpayOrderId + amount to the frontend so it can open
//      the Razorpay checkout modal
//
// IMPORTANT: Razorpay amounts are in PAISE (1 rupee = 100 paise).
//   So ₹875 → 87500 paise.  We always multiply by 100 when sending to Razorpay
//   and divide by 100 when displaying to the user.
//
// bookingMongoId  → The MongoDB _id of the Booking document (not the human
//                   readable "PAY-XXXXXX" bookingId)
// =============================================================================
export const createRazorpayOrder = async (userId, bookingMongoId) => {
    // ── 1. Load and validate the booking ─────────────────────────────────────
    const booking = await Booking.findById(bookingMongoId);
    if (!booking) throw new ApiError(404, "Booking not found.");

    // Ownership check — only the user who created the booking can pay for it
    if (booking.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to pay for this booking.");
    }

    // ── 2. Idempotency check — prevent double-charging ───────────────────────
    // If the booking is already confirmed (paid), reject the request
    if (booking.bookingStatus === "CONFIRMED" && booking.paymentStatus === "SUCCESS") {
        throw new ApiError(409, "This booking has already been paid for.");
    }

    // If booking is CANCELLED, reject the request
    if (booking.bookingStatus === "CANCELLED") {
        throw new ApiError(409, "This booking has been cancelled. Please create a new booking.");
    }

    // If there's already a CREATED payment for this booking, return it
    // (handles browser refresh / accidental double-click on "Pay Now")
    const existingPayment = await Payment.findOne({
        bookingId: booking._id,
        status: "CREATED",
    });
    if (existingPayment) {
        return {
            razorpayOrderId: existingPayment.razorpayOrderId,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            bookingMongoId: booking._id,
            bookingId: booking.bookingId,
        };
    }

    // ── Allow retry: if previous payment FAILED, we can create a new order ────
    // No need to do anything special — just proceed to create a new Razorpay order below.

    // ── 3. Create the Razorpay order ─────────────────────────────────────────
    // receipt → a short reference visible in the Razorpay dashboard
    // notes   → metadata attached to the order (visible in dashboard, not to user)
    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(booking.totalFare * 100), // Convert to paise (smallest unit)
        currency: "INR",
        receipt: booking.bookingId, // e.g. "PAY-A3F2B1"
        notes: {
            bookingId: booking.bookingId,
            userId: userId.toString(),
            scheduleId: booking.scheduleId.toString(),
        },
    });

    // ── 4. Persist the payment record ────────────────────────────────────────
    // We create this NOW (before user pays) so we have an audit trail even if
    // the user closes the browser mid-payment.
    await Payment.create({
        bookingId: booking._id,
        userId,
        razorpayOrderId: razorpayOrder.id, // "order_xxxxxxxxxxxx"
        amount: booking.totalFare,         // In rupees for our DB readability
        currency: "INR",
        status: "CREATED",
    });

    // ── 5. Return order details to the frontend ───────────────────────────────
    // The frontend needs razorpayOrderId + amount to open the Razorpay modal.
    return {
        razorpayOrderId: razorpayOrder.id,
        amount: booking.totalFare,       // Rupees (for display)
        currency: "INR",
        bookingMongoId: booking._id,
        bookingId: booking.bookingId,    // Human-readable PNR e.g. "PAY-A3F2B1"
    };
};

// =============================================================================
// STEP 2 — VERIFY PAYMENT & CONFIRM BOOKING
// =============================================================================
//
// Called from: POST /api/v1/payments/verify
//
// What happens after Razorpay checkout:
//   Razorpay sends 3 values to the frontend's success handler:
//     razorpay_order_id   → same orderId we created in step 1
//     razorpay_payment_id → new ID generated by Razorpay when user paid
//     razorpay_signature  → HMAC-SHA256(orderId + "|" + paymentId, KEY_SECRET)
//
//   The frontend forwards all 3 + bookingMongoId to this endpoint.
//
// SIGNATURE VERIFICATION (critical security step):
//   We re-compute the expected signature using our secret key.
//   If it matches what Razorpay sent → payment is genuine.
//   If it doesn't match → someone tampered with the data → reject.
//
// ON SUCCESS:
//   - Payment doc → status: SUCCESS
//   - Booking doc → status: CONFIRMED, paymentStatus: SUCCESS
//   - Schedule seats → marked BOOKED (if not already done in block-seats flow)
//   - Redis seat locks → released
// =============================================================================
export const verifyAndConfirmPayment = async (userId, payload) => {
    const {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        bookingMongoId,
    } = payload;

    // ── 1. Verify the HMAC-SHA256 signature ──────────────────────────────────
    // The string to sign is: orderId + "|" + paymentId
    // The key is our RAZORPAY_KEY_SECRET (never expose to frontend)
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

    if (expectedSignature !== razorpaySignature) {
        logger.error("Payment signature mismatch", { razorpayOrderId });
        throw new ApiError(400, "Payment verification failed. Invalid signature.");
    }

    // ── 2. Load the pending payment record ───────────────────────────────────
    const payment = await Payment.findOne({ razorpayOrderId });
    if (!payment) {
        throw new ApiError(404, "No payment record found for this order ID.");
    }

    // Guard against replaying an already-verified payment
    if (payment.status === "SUCCESS") {
        throw new ApiError(409, "This payment has already been verified.");
    }

    // ── 3. Load the booking ───────────────────────────────────────────────────
    const booking = await Booking.findById(bookingMongoId);
    if (!booking) throw new ApiError(404, "Booking not found.");

    if (booking.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to verify this payment.");
    }

    // ── 4. Atomic transaction: confirm booking + update payment ───────────────
    // Using a MongoDB session so both updates succeed or both roll back.
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            // 4a. Confirm the booking
            booking.bookingStatus = "CONFIRMED";
            booking.paymentStatus = "SUCCESS";
            booking.paymentReference = razorpayPaymentId; // Store Razorpay payment ID
            booking.bookedAt = new Date();
            await booking.save({ session });

            // 4b. Update the payment record
            payment.razorpayPaymentId = razorpayPaymentId;
            payment.razorpaySignature = razorpaySignature;
            payment.status = "SUCCESS";
            await payment.save({ session });
        });
    } finally {
        session.endSession();
    }

    // ── 5. Release Redis seat locks ───────────────────────────────────────────
    // Payment verified → DB is source of truth → free up Redis memory
    try {
        const schedule = await Schedule.findById(booking.scheduleId).select("seats");
        if (schedule) {
            const pipeline = redis.pipeline();
            for (const seatNumber of booking.bookedSeats) {
                pipeline.del(`seat_lock:${booking.scheduleId}:${seatNumber}`);
            }
            await pipeline.exec();
        }
    } catch (redisErr) {
        // Non-fatal — Redis TTL will clean up. Log but don't fail the request.
        logger.warn("Redis seat lock cleanup error (non-fatal)", { error: redisErr.message });
    }

    // ── 6. Return confirmed booking details ───────────────────────────────────
    const confirmedBooking = await Booking.findById(bookingMongoId)
        .populate("userId",     "name email")
        .populate("busId",      "busName busNumber busType operatorName")
        .populate("routeId",    "source destination")
        .populate("scheduleId", "departureDate departureTime arrivalTime");

    // ── 7. Send booking confirmation email with PDF ticket (truly non-blocking) ───────
    // A failed email MUST NOT roll back a confirmed payment.
    // We don't await this - it runs in the background after response is sent.
    setImmediate(async () => {
        try {
            const u   = confirmedBooking.userId;
            const sch = confirmedBooking.scheduleId;
            const rt  = confirmedBooking.routeId;
            const bus = confirmedBooking.busId;
            const bp  = confirmedBooking.boardingPoint;
            const dp  = confirmedBooking.droppingPoint;

            const depDate = sch?.departureDate
                ? new Date(sch.departureDate).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      timeZone: "Asia/Kolkata",
                  })
                : "—";

            // Generate the PDF ticket buffer
            const pdfBuffer = await generateTicketPDF(confirmedBooking);

            await sendBookingConfirmationEmail(u.email, {
                bookingId:     confirmedBooking.bookingId,
                userName:      u.name,
                busName:       bus?.busName    || "—",
                busNumber:     bus?.busNumber  || "—",
                source:        rt?.source?.city      || "—",
                destination:   rt?.destination?.city || "—",
                departureDate: depDate,
                departureTime: sch?.departureTime || "—",
                arrivalTime:   sch?.arrivalTime   || "—",
                boardingPoint: bp ? `${bp.name}, ${bp.time}` : "—",
                droppingPoint: dp ? `${dp.name}, ${dp.time}` : "—",
                passengers:    confirmedBooking.passengerDetails,
                totalFare:     confirmedBooking.totalFare,
                paymentId:     razorpayPaymentId,
                pdfBuffer,   // ← attached to email as PDF
            });
            logger.info("Booking confirmation email sent", { bookingId: confirmedBooking.bookingId });
        } catch (emailErr) {
            logger.warn("Booking confirmation email error (non-fatal)", { error: emailErr.message });
        }
    });

    return {
        booking: confirmedBooking,
        payment: {
            razorpayOrderId: payment.razorpayOrderId,
            razorpayPaymentId: payment.razorpayPaymentId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            createdAt: payment.createdAt,
        },
    };
};

// =============================================================================
// PAYMENT FAILURE HANDLER
// =============================================================================
//
// Called from: POST /api/v1/payments/failure
//
// When Razorpay checkout fails (user cancels, card declined, etc.),
// the frontend calls this endpoint to log the failure in our DB.
// The booking remains PENDING — the user can retry payment.
//
// WHY THIS EXISTS:
//   Without this, failed payments leave orphaned CREATED Payment docs.
//   Logging failures gives us visibility into drop-off rates and errors.
// =============================================================================
export const handlePaymentFailure = async (userId, payload) => {
    const { razorpayOrderId, errorCode, errorDescription, bookingMongoId } = payload;

    // Update the payment record to FAILED status
    const payment = await Payment.findOne({ razorpayOrderId });
    if (payment && payment.status === "CREATED") {
        payment.status = "FAILED";
        payment.failureReason = errorDescription || errorCode;
        await payment.save();
    }

    // ── Keep booking as PENDING for retry ──────────────────────────────────────
    // The booking stays PENDING so the user can retry payment.
    // Seats remain reserved in the Schedule (marked as BOOKED).
    // A cron job or TTL will eventually clean up abandoned PENDING bookings.
    // We do NOT release seats here — the user may want to retry.

    // Log for observability
    logger.warn("Payment failure recorded", { razorpayOrderId, errorCode, errorDescription });

    return {
        message: "Payment failure recorded. You can retry payment for this booking.",
        bookingMongoId,
        canRetry: true,
    };
};

// =============================================================================
// INITIATE REFUND (called during booking cancellation)
// =============================================================================
//
// Called from: booking.service.js → cancelBookingService()
//
// What this does:
//   1. Finds the successful Payment record for the booking
//   2. Calls Razorpay's refund API with the calculated refund amount
//   3. Updates the Payment doc with the refund ID + status
//
// Razorpay refund flow:
//   We call razorpay.payments.refund(paymentId, { amount: paise })
//   Razorpay immediately returns a refund ID ("rfnd_xxx")
//   The actual money reaches the user in 5-7 business days.
//
// refundAmount → in RUPEES (we convert to paise internally)
// =============================================================================
export const initiateRefund = async (bookingMongoId, refundAmount) => {
    // Find the successful payment for this booking
    const payment = await Payment.findOne({
        bookingId: bookingMongoId,
        status: "SUCCESS",
    });

    if (!payment || !payment.razorpayPaymentId) {
        logger.warn("No Razorpay payment found for refund — skipping", { bookingMongoId });
        return null;
    }

    try {
        // Razorpay refund API expects amount in PAISE
        const razorpayRefund = await razorpay.payments.refund(
            payment.razorpayPaymentId,
            {
                amount: Math.round(refundAmount * 100), // rupees → paise
                notes: {
                    reason: "Customer requested cancellation",
                    bookingId: bookingMongoId.toString(),
                },
            }
        );

        // Update Payment doc with refund details
        payment.status = "REFUNDED";
        payment.refundId = razorpayRefund.id; // "rfnd_xxxxxxxxxxxx"
        payment.refundAmount = refundAmount;
        payment.refundInitiatedAt = new Date();
        await payment.save();

        return razorpayRefund;
    } catch (razorpayErr) {
        // Log but don't crash the cancellation — the booking is cancelled regardless.
        // A human or cron job can retry the refund using the Payment doc's bookingId.
        logger.error("Razorpay refund API error", {
            razorpayPaymentId: payment.razorpayPaymentId,
            error: razorpayErr.message,
        });
        return null;
    }
};

// =============================================================================
// GET PAYMENT STATUS
// =============================================================================
//
// Called from: GET /api/v1/payments/status/:bookingMongoId
//
// Returns the payment status for a given booking.
// Used by the frontend to poll for payment confirmation after checkout.
// =============================================================================
export const getPaymentStatus = async (userId, bookingMongoId) => {
    const booking = await Booking.findById(bookingMongoId).select("userId bookingId bookingStatus paymentStatus");
    if (!booking) throw new ApiError(404, "Booking not found.");

    if (booking.userId.toString() !== userId.toString()) {
        throw new ApiError(403, "You are not authorized to view this payment status.");
    }

    const payment = await Payment.findOne({ bookingId: bookingMongoId })
        .sort({ createdAt: -1 }) // Most recent payment attempt
        .select("razorpayOrderId razorpayPaymentId amount currency status refundId refundAmount createdAt");

    return {
        booking: {
            bookingId: booking.bookingId,
            bookingStatus: booking.bookingStatus,
            paymentStatus: booking.paymentStatus,
        },
        payment: payment || null,
    };
};
