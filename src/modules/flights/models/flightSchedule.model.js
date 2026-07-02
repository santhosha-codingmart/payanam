// ─────────────────────────────────────────────────────────────────────────────
// FlightSchedule Model — A specific flight on a specific date
// This ties together a Flight (aircraft) and a FlightRoute for a particular
// journey date. It holds the ACTUAL booking state for every seat on this trip.
//
// WHY NOT STORE SEATS ON THE FLIGHT MODEL?
//   Because a flight might operate daily. If seat 3A is booked on Monday's
//   flight, that shouldn't affect Tuesday's. By creating a FlightSchedule
//   document for each date and COPYING the seat layout there, each trip is
//   completely independent.
//
// LIFECYCLE:
//   1. Vendor creates a FlightSchedule → all seats start as "AVAILABLE"
//   2. Passenger blocks a seat via Redis → seat becomes "BLOCKED" (10 min TTL)
//   3. Passenger confirms booking → seat becomes "BOOKED" in DB
//   4. If TTL expires without booking → seat reverts to "AVAILABLE"
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

const flightScheduleSchema = new mongoose.Schema(
    {
        // ── References ───────────────────────────────────────────────────────

        // Which route does this schedule follow?
        // E.g., the DEL → BOM route
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FlightRoute",
            required: true,
            index: true,
        },

        // Which physical aircraft is flying this schedule?
        flightId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Aircraft",
            required: true,
            index: true,
        },

        // Flight number for this specific schedule (e.g. "6E204")
        flightNumber: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
        },

        // Which vendor (airline) is operating this flight?
        // Stored redundantly to avoid a multi-hop join when doing owner checks.
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ── Timing ───────────────────────────────────────────────────────────

        // The calendar date of departure (stored at midnight UTC)
        departureDate: {
            type: Date,
            required: true,
        },

        // The calendar date of arrival — may differ from departureDate
        // for overnight or ultra-long-haul flights
        arrivalDate: {
            type: Date,
            required: true,
        },

        // Local departure time string (Format: "HH:mm", e.g., "06:30")
        departureTime: {
            type: String,
            required: true,
        },

        // Local arrival time string (Format: "HH:mm", e.g., "08:45")
        arrivalTime: {
            type: String,
            required: true,
        },

        // ── Pricing ──────────────────────────────────────────────────────────

        // The starting/base fare for an economy seat on this trip.
        // Individual seat fares in the `seats` array may override this.
        baseFare: {
            type: Number,
            required: true,
            min: 0,
        },

        // ── Availability ─────────────────────────────────────────────────────

        // Quick counter of total available seats across ALL cabin classes.
        // Decremented on booking, incremented on cancellation.
        // Prevents scanning the entire seats array just to show a number.
        availableSeats: {
            type: Number,
            required: true,
            min: 0,
        },

        // ── The Seat Map (Snapshot) ──────────────────────────────────────────
        // CRITICAL CONCEPT: This array is a COPY of `flight.seatLayout`.
        // When the schedule is created, we copy the aircraft's layout here and
        // add booking-specific fields (status, passengerName, etc.).
        // This snapshot approach means every trip is independently bookable.
        seats: [
            {
                // ── Copied from Flight.seatLayout ──

                // Seat identifier, e.g., "3A", "12C"
                seatNumber: { type: String, required: true },

                // Cabin class this seat belongs to
                cabinClass: {
                    type: String,
                    enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
                    default: "ECONOMY",
                },

                // Window, aisle, or middle position
                seatType: {
                    type: String,
                    enum: ["window", "aisle", "middle"],
                    default: "aisle",
                },

                // Physical row number (for UI rendering)
                row: { type: Number },

                // Column layout
                column: { type: Number },

                // Does this seat have extra legroom?
                isExtraLegroom: { type: Boolean, default: false },

                // Price for this specific seat on this specific trip
                fare: { type: Number, default: 0 },

                // ── Trip-Specific Booking State ──

                // Current booking state of this seat
                status: {
                    type: String,
                    enum: ["AVAILABLE", "BOOKED", "BLOCKED"],
                    default: "AVAILABLE",
                },

                // Which User ID has booked (or is blocking) this seat?
                bookedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
                },

                // Passenger details stored for the ticket/boarding pass
                passengerName: { type: String, default: null },
                passengerAge: { type: Number, default: null },
                passengerGender: {
                    type: String,
                    enum: ["M", "F", "O", null],
                    default: null,
                },
            },
        ],

        // ── Terminal Information ──────────────────────────────────────────────
        // Which terminal at the source airport does this flight depart from?
        // This can vary by date/schedule even for the same route.
        departureTerminal: {
            type: String,
            trim: true,
        },

        // Which terminal at the destination airport does this flight arrive at?
        arrivalTerminal: {
            type: String,
            trim: true,
        },

        // ── Meal Options ─────────────────────────────────────────────────────
        // What meal options are available to passengers on this trip?
        mealOptions: [
            {
                type: String,
                enum: ["VEG", "NON_VEG", "VEGAN", "JAIN", "DIABETIC"],
            },
        ],

        // ── Cancellation Policy ──────────────────────────────────────────────
        // Refund tiers: how much is refunded depending on how early you cancel.
        // E.g., cancel 24h before → 75% refund; cancel 2h before → 0% refund.
        cancellationPolicy: [
            {
                hoursBeforeDeparture: { type: Number, required: true },
                refundPercentage: { type: Number, required: true, min: 0, max: 100 },
            },
        ],

        // ── Status ───────────────────────────────────────────────────────────
        // Current operational status of this specific trip
        status: {
            type: String,
            enum: ["SCHEDULED", "BOARDING", "DEPARTED", "COMPLETED", "CANCELLED", "DELAYED"],
            default: "SCHEDULED",
        },
    },
    {
        timestamps: true, // Auto-adds createdAt and updatedAt
    }
);

// ── Indexes for Search Optimization ──────────────────────────────────────────

// The most critical search query: "Find me all flights on Route X on Date Y"
flightScheduleSchema.index({ routeId: 1, departureDate: 1 });

// Duplicate prevention: "Is this aircraft already scheduled on Date Y at Time Z?"
flightScheduleSchema.index({ flightId: 1, departureDate: 1, departureTime: 1 }, { unique: true });

export const FlightSchedule = mongoose.model("FlightSchedule", flightScheduleSchema);
