// =============================================================================
// Booking Model — The core record of every bus ticket purchase.
//
// WHY THIS MODEL EXISTS:
// When a user pays for a bus seat, we need a permanent record that:
//   1. Proves which user owns which seats on which trip.
//   2. Drives the ticket UI (show QR code, passenger names, etc).
//   3. Enables cancellations + refund calculations.
//   4. Allows review validation (user must have a completed booking to review).
//
// DATA FLOW:
//   Frontend (Checkout page) → POST /api/v1/bookings → bookingController
//   → bookingService (verify Redis lock, create this document, update Schedule seats)
//   → MongoDB bookings collection
// =============================================================================

import mongoose from "mongoose";
import crypto from "crypto";

// ─── Sub-schema: One passenger per booked seat ───────────────────────────────
// WHY: A single booking may cover multiple passengers (family trip).
// Each entry links directly to a seat number on the Schedule.
const passengerSchema = new mongoose.Schema(
    {
        seatNumber: {
            type: String,
            required: true,
            // E.g., "L3" (lower deck, seat 3)
        },
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        age: {
            type: Number,
            required: true,
            min: 1,
            max: 120,
        },
        gender: {
            type: String,
            required: true,
            enum: ["male", "female", "other"],
        },
        // Optional: needed for state-level travel documents in India
        idType: {
            type: String,
            enum: ["AADHAR", "PAN", "PASSPORT", "DRIVING_LICENSE"],
            required: false,
            default: null,
        },
        idNumber: {
            type: String,
            default: null,
        },
    },
    { _id: false } // No need for a sub-document ObjectId per passenger
);

// ─── Sub-schema: Boarding & Dropping point chosen at booking ─────────────────
// WHY: These are the specific stop names/times the user chose during checkout.
// We snapshot them here so future Route edits don't corrupt historical bookings.
const pointSchema = new mongoose.Schema(
    {
        // The ObjectId of the stop in the Schedule's boardingPoints/droppingPoints array
        pointId: { type: mongoose.Schema.Types.ObjectId },
        city: { type: String },
        name: { type: String },    // E.g., "Koyambedu Bus Stand"
        address: { type: String }, // E.g., "Koyambedu, Chennai - 600107"
        time: { type: String },    // HH:mm — the stop time
    },
    { _id: false }
);

// ─── Main Booking Schema ──────────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema(
    {
        // ── Unique ticket identifier (human-readable, like PNR) ──────────────
        // WHY: Users display this ID on their phone at the bus. It must be short
        // and memorable, unlike a MongoDB ObjectId (24 chars).
        bookingId: {
            type: String,
            unique: true,
            // Auto-generated in the pre-save hook below
        },

        // ── Who booked ───────────────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true, // Speeds up "my bookings" queries
        },

        // ── Which trip ───────────────────────────────────────────────────────
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Schedule",
            required: true,
            index: true,
        },
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
        },
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // The vendor user account
            required: true,
        },
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
        },

        // ── Journey segment ──────────────────────────────────────────────────
        boardingPoint: {
            type: pointSchema,
            required: true,
        },
        droppingPoint: {
            type: pointSchema,
            required: true,
        },

        // ── Passengers (one per booked seat) ─────────────────────────────────
        passengerDetails: {
            type: [passengerSchema],
            validate: {
                validator: (arr) => arr.length >= 1,
                message: "At least one passenger is required",
            },
        },

        // ── Which seats (array of seat numbers) ──────────────────────────────
        // E.g., ["L1", "L2", "U5"]
        bookedSeats: {
            type: [String],
            required: true,
        },

        // ── Financial ────────────────────────────────────────────────────────
        totalFare: {
            type: Number,
            required: true,
            min: 0,
        },
        // Snapshot of the cancellation policy at time of booking.
        // WHY SNAPSHOT: If the operator changes the policy later, existing
        // bookings should still honour the policy the user agreed to.
        cancellationPolicy: [
            {
                hoursBeforeDeparture: Number,
                refundPercentage: Number,
                _id: false,
            },
        ],

        // ── Status ───────────────────────────────────────────────────────────
        bookingStatus: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "CANCELLED"],
            default: "PENDING",
        },
        paymentStatus: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
            default: "PENDING",
        },

        // ── Payment ──────────────────────────────────────────────────────────
        // Stores whatever the payment gateway returns (Razorpay order ID, etc).
        // For now we use a mock reference.
        paymentReference: {
            type: String,
            default: null,
        },
        refundAmount: {
            type: Number,
            default: 0,
        },

        // ── Lifecycle timestamps ──────────────────────────────────────────────
        // Mongoose adds createdAt/updatedAt from the timestamps option below.
        // These extra ones are more semantically meaningful for business logic.
        bookedAt: {
            type: Date,
            default: null,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
    },
    {
        // Automatically manages createdAt and updatedAt fields
        timestamps: true,
    }
);

// ─── Pre-save hook: Auto-generate human-readable bookingId ───────────────────
// WHY: We generate a short unique ID like "PAY-A3F2B1" instead of exposing
// the raw 24-char ObjectId to the user on their ticket.
// WHEN IT RUNS: Mongoose calls this BEFORE every .save() call.
//
// NOTE: Using async style (no `next` parameter) — modern Mongoose resolves the
// hook automatically when the async function returns. Using callback-style
// function(next) fails during transactions because Mongoose doesn't pass `next`.
bookingSchema.pre("save", async function () {
    if (!this.bookingId) {
        // crypto.randomBytes(3) gives 3 random bytes → 6 hex characters
        const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
        this.bookingId = `PAY-${randomHex}`;
    }
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Compound index so "find all bookings for this schedule" is fast.
// This is critical for the check-in API and the seat layout page.
bookingSchema.index({ scheduleId: 1, bookedSeats: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
