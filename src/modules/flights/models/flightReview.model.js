// ─────────────────────────────────────────────────────────────────────────────
// FlightReview Model — Passenger reviews for a specific flight
// Passengers can leave a rating and written review after completing a journey.
// One booking = one review (enforced by the `unique` constraint on bookingId).
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const flightReviewSchema = new mongoose.Schema(
    {
        // Who wrote this review?
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Which flight (aircraft) is being reviewed?
        // This is the Flight model (not the schedule), because reviews persist
        // across multiple trips. "IndiGo 6E-204" gets one combined rating.
        flightId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Flight",
            required: true,
            index: true, // Makes queries like "get all reviews for flight X" fast
        },

        // Which booking does this review belong to?
        // `unique: true` enforces one review per booking — prevents spam.
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true,
        },

        // Star rating: 1 (terrible) → 5 (excellent)
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        // The written review text
        review: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000, // Cap at 1000 characters to prevent abuse
        },
    },
    { timestamps: true } // Auto-adds createdAt and updatedAt
);

export const FlightReview = mongoose.model("FlightReview", flightReviewSchema);
