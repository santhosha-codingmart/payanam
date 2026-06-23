import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
    {
        routeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Route",
            required: true,
            index: true,
        },

        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
            index: true,
        },

        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        departureDate: {
            type: Date,
            required: true,
        },

        departureTime: {
            type: String, // "HH:mm" format
            required: true,
        },

        arrivalTime: {
            type: String, // "HH:mm" format
            required: true,
        },

        baseFare: {
            type: Number,
            required: true,
            min: 0,
        },

        availableSeats: {
            type: Number,
            required: true,
            min: 0,
        },

        // Snapshot of every seat for this specific trip — copied from bus.seatLayout
        // Each seat tracks its own booking status independently per trip
        seats: [
            {
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
                status: {
                    type: String,
                    enum: ["AVAILABLE", "BOOKED", "BLOCKED"],
                    default: "AVAILABLE",
                },
                bookedBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    default: null,
                },
                passengerName: { type: String, default: null },
                passengerAge: { type: Number, default: null },
                passengerGender: {
                    type: String,
                    enum: ["M", "F", "O", null],
                    default: null,
                },
            },
        ],

        // Boarding & dropping points for user convenience
        boardingPoints: [
            {
                name: { type: String, required: true },
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

        // Cancellation policy tiers
        cancellationPolicy: [
            {
                hoursBeforeDeparture: { type: Number, required: true },
                refundPercentage: { type: Number, required: true, min: 0, max: 100 },
            },
        ],

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

// Compound index for the primary search pattern: find schedules by route + date
scheduleSchema.index({ routeId: 1, departureDate: 1 });
// Index for finding all schedules for a specific bus on a date (duplicate check)
scheduleSchema.index({ busId: 1, departureDate: 1, departureTime: 1 });

export const Schedule = mongoose.model("Schedule", scheduleSchema);
