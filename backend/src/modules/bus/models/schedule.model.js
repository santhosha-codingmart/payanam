// ─────────────────────────────────────────────────────────────────────────────
// Schedule Model — A specific trip on a specific date
// This ties together a Bus and a Route for a particular journey.
// It holds the ACTUAL booking state for the seats on this trip.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
    {
        // ── References ───────────────────────────────────────────────────
        
        // Which route is this trip following?
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
            index: true,
        },

        // Which physical bus is driving this trip?
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
            index: true,
        },

        // Who is operating this trip? (Redundant but saves a join query later)
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── Timing ───────────────────────────────────────────────────────
        
        // The date this trip starts (stores as a Date object at midnight UTC)
        departureDate: {
            type: Date,
            required: true,
        },

        // Local departure and arrival times for the full journey
        departureTime: {
            type: String, // Format: "HH:mm" (e.g., "22:30")
            required: true,
        },
        arrivalTime: {
            type: String, // Format: "HH:mm"
            required: true,
        },

        // ── Pricing & Availability ───────────────────────────────────────
        
        // The starting price for a seat on this trip
        baseFare: {
            type: Number,
            required: true,
            min: 0,
        },

        // Quick counter for available seats. 
        // Decreased by 1 each time a seat is booked.
        // Prevents having to scan the entire seats array just to show a number.
        availableSeats: {
            type: Number,
            required: true,
            min: 0,
        },

        // ── The Seat Map (Snapshot) ──────────────────────────────────────
        // CRITICAL CONCEPT: This array is a COPY of `bus.seatLayout`.
        // When the schedule is created, we copy the bus's layout here and
        // add booking-specific fields (status, passengerName, etc).
        // This means every single trip has its own independent seat state.
        seats: [
            {
                // Copied from Bus
                seatNumber: { type: String, required: true },
                seatType: {
                    type: String,
                    enum: ["window", "aisle", "middle"],
                    default: "aisle",
                },
                deck: {
                    type: String,
                    enum: ["lower", "upper"],
                    default: "lower",
                },
                row: { type: Number },
                column: { type: Number },
                isSleeper: { type: Boolean, default: false },
                fare: { type: Number, default: 0 },
                
                // Trip-specific booking state
                status: {
                    type: String,
                    enum: ["AVAILABLE", "BOOKED", "BLOCKED"],
                    default: "AVAILABLE",
                },
                // If booked, which User ID booked it?
                bookedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
                },
                // Passenger details for the ticket
                passengerName: { type: String, default: null },
                passengerAge: { type: Number, default: null },
                passengerGender: {
                    type: String,
                    enum: ["M", "F", "O", null],
                    default: null,
                },
            },
        ],

        // ── Boarding & Dropping Points ───────────────────────────────────
        // Specific locations in the source/destination cities where passengers
        // can get on/off the bus.
        boardingPoints: [
            {
                name: { type: String, required: true }, // e.g., "Koyambedu"
                address: { type: String },
                time: { type: String, required: true }, // "HH:mm"
                landmark: { type: String },
            },
        ],

        droppingPoints: [
            {
                name: { type: String, required: true },
                address: { type: String },
                time: { type: String, required: true }, // "HH:mm"
                landmark: { type: String },
            },
        ],

        // ── Policies ─────────────────────────────────────────────────────
        // Refund policy. E.g., cancel 24 hours before = 75% refund.
        cancellationPolicy: [
            {
                hoursBeforeDeparture: { type: Number, required: true },
                refundPercentage: { type: Number, required: true, min: 0, max: 100 },
            },
        ],

        // ── Status ───────────────────────────────────────────────────────
        // Current state of this specific trip
        status: {
            type: String,
            enum: ["SCHEDULED", "IN_TRANSIT", "COMPLETED", "CANCELLED"],
            default: "SCHEDULED",
        },
    },
    {
        timestamps: true,
    }
);

// ── Indexes for Search Optimization ──────────────────────────────────────

// The most common query: "Find me all trips on Route X on Date Y"
scheduleSchema.index({ routeId: 1, departureDate: 1 });

// Prevent duplicate schedules: "Is Bus X already scheduled on Date Y at Time Z?"
scheduleSchema.index({ busId: 1, departureDate: 1, departureTime: 1 });

export const Schedule = mongoose.model("Schedule", scheduleSchema);
