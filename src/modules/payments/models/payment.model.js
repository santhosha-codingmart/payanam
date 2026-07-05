// =============================================================================
// Payment Model — Persistent record of every Razorpay transaction
//
// WHY THIS MODEL EXISTS:
//   The Booking model tracks booking lifecycle (PENDING → CONFIRMED).
//   This model tracks the payment lifecycle separately, which gives us:
//   1. A full audit trail — every payment attempt, success, and failure is
//      stored with Razorpay's IDs (orderId, paymentId, signature).
//   2. Refund tracking — when a booking is cancelled, the refund record
//      lives here, linked to the original paymentId.
//   3. Reconciliation — finance team can cross-check our DB against Razorpay's
//      dashboard using the razorpayOrderId and razorpayPaymentId.
//
// RAZORPAY FLOW:
//   Backend creates Order → Frontend opens Razorpay checkout →
//   User pays → Razorpay calls frontend with paymentId + signature →
//   Frontend sends to our /verify endpoint → Backend verifies signature →
//   Backend confirms booking + creates this Payment document
// =============================================================================

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        // ── Which booking this payment covers ────────────────────────────────
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            index: true,
        },

        // ── Who is paying ────────────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── Razorpay identifiers ─────────────────────────────────────────────
        // razorpayOrderId  → Created by our backend: "order_xxxxxxxxxxxx"
        // razorpayPaymentId → Returned by Razorpay after user pays: "pay_xxxxxxxxxxxx"
        // razorpaySignature → HMAC-SHA256 hash we verify to confirm authenticity
        razorpayOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        razorpayPaymentId: {
            type: String,
            default: null, // Null until payment is verified
        },
        razorpaySignature: {
            type: String,
            default: null, // Null until payment is verified
        },

        // ── Financial ────────────────────────────────────────────────────────
        // Razorpay works in the smallest currency unit (paise for INR).
        // We store the original rupee amount for readability.
        amount: {
            type: Number, // In rupees (e.g., 875)
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: "INR",
        },

        // ── Status ───────────────────────────────────────────────────────────
        // CREATED    → Razorpay order created, awaiting user payment
        // SUCCESS    → Payment verified and booking confirmed
        // FAILED     → Payment failed or verification failed
        // REFUNDED   → Booking was cancelled and refund initiated via Razorpay
        status: {
            type: String,
            enum: ["CREATED", "SUCCESS", "FAILED", "REFUNDED"],
            default: "CREATED",
        },

        // ── Refund tracking ──────────────────────────────────────────────────
        refundId: {
            type: String,
            default: null, // Razorpay refund ID: "rfnd_xxxxxxxxxxxx"
        },
        refundAmount: {
            type: Number,
            default: 0,
        },
        refundInitiatedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true, // createdAt = order creation time, updatedAt = last status change
    }
);

// Compound index for looking up payment by booking + status
paymentSchema.index({ bookingId: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;
