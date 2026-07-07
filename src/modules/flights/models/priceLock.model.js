// =============================================================================
// PriceLock Model — Freeze a flight's fare for a limited period
//
// WHY THIS MODEL EXISTS:
// Users may want to hold a fare while they finalize plans. Instead of booking
// immediately, they pay a small non-refundable fee to "lock" the current price
// for a set duration. This model records each lock and tracks its lifecycle.
//
// LIFECYCLE:
//   1. User selects a flight → clicks "Lock Price" → pays the lock fee
//   2. PriceLock document created with status ACTIVE and an expiresAt timestamp
//   3. Before expiry, user completes full booking → status becomes USED
//   4. If user doesn't book in time → status becomes EXPIRED
//   5. If the flight sells out before user books → status becomes REFUNDED
//
// FARE PROTECTION RULES:
//   - If fare increases: user pays the LOCKED fare (up to protectionLimit)
//   - If fare decreases: user pays the LOWER current fare
//   - The lock fee is non-refundable and NOT applied toward the ticket price
// =============================================================================

import mongoose from "mongoose";
import crypto from "crypto";

// ─── Flight Snapshot Sub-Schema ──────────────────────────────────────────────
// WHY SNAPSHOT: We freeze flight details at lock time so that future schedule
// edits (time changes, terminal changes) don't corrupt the user's locked view.
const flightSnapshotSchema = new mongoose.Schema(
    {
        airlineName: { type: String, required: true },
        flightNumber: { type: String, required: true },
        source: { type: String, required: true },          // e.g. "Delhi (DEL)"
        destination: { type: String, required: true },      // e.g. "Mumbai (BOM)"
        departureDate: { type: Date, required: true },
        departureTime: { type: String, required: true },    // "HH:mm"
        arrivalTime: { type: String, required: true },      // "HH:mm"
        cabinClass: { type: String, default: "ECONOMY" },
    },
    { _id: false }
);

// ─── Main PriceLock Schema ───────────────────────────────────────────────────
const priceLockSchema = new mongoose.Schema(
    {
        // ── Human-readable ID (like PNR for bookings) ────────────────────────
        priceLockId: {
            type: String,
            unique: true,
            // Auto-generated in pre-save hook below
        },

        // ── Who locked ───────────────────────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── Which flight schedule ────────────────────────────────────────────
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FlightSchedule",
            required: true,
            index: true,
        },

        // ── Fare details ─────────────────────────────────────────────────────
        lockedFare: {
            type: Number,
            required: true,
            min: 0,
        },
        lockFee: {
            type: Number,
            required: true,
            min: 0,
        },
        // Maximum fare increase the platform absorbs (default ₹7,500)
        protectionLimit: {
            type: Number,
            default: 7500,
        },

        // ── Lock duration ────────────────────────────────────────────────────
        lockDurationId: {
            type: String,
            required: true,
            enum: ["4h", "8h", "12h", "1d", "3d", "7d"],
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },

        // ── Status ───────────────────────────────────────────────────────────
        status: {
            type: String,
            enum: ["ACTIVE", "USED", "EXPIRED", "REFUNDED"],
            default: "ACTIVE",
            index: true,
        },

        // ── Frozen flight details ────────────────────────────────────────────
        flightSnapshot: {
            type: flightSnapshotSchema,
            required: true,
        },

        // ── Payment ──────────────────────────────────────────────────────────
        paymentReference: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true, // createdAt + updatedAt
    }
);

// ─── Pre-save: Auto-generate human-readable priceLockId ──────────────────────
priceLockSchema.pre("save", async function () {
    if (!this.priceLockId) {
        const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
        this.priceLockId = `PL-${randomHex}`;
    }
});

// ─── Indexes ─────────────────────────────────────────────────────────────────
// Speeds up "find all active locks for this user" queries
priceLockSchema.index({ userId: 1, status: 1 });
// Prevent duplicate active locks on the same schedule by the same user
priceLockSchema.index({ userId: 1, scheduleId: 1, status: 1 });

const PriceLock = mongoose.model("PriceLock", priceLockSchema);
export default PriceLock;
