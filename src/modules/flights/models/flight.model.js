// ─────────────────────────────────────────────────────────────────────────────
// Flight Model — The physical aircraft entity
// This represents a real-world aircraft owned by an airline (vendor/operator).
// It stores the aircraft's fixed properties like seats, class configuration,
// and amenities. Think of this as the "template" — it doesn't change trip to trip.
// Every FlightSchedule (specific trip) will COPY this seat layout into itself.
// ─────────────────────────────────────────────────────────────────────────────

import mongoose from "mongoose";

// ── Schema Definition ─────────────────────────────────────────────────────────
// This is the blueprint for every "Flight" document stored in MongoDB's
// "flights" collection.
const flightSchema = new mongoose.Schema(
    {
        // ── Owner Reference ──────────────────────────────────────────────────
        // Which vendor (airline operator) owns this aircraft?
        // This is a "foreign key" pointing to the User collection.
        // Used for ownership checks: "you can only edit YOUR flights"
        operatorId: {
            type: mongoose.Schema.Types.ObjectId, // MongoDB's 24-char hex ObjectId
            ref: "User",                          // Points to the User model
            required: true,
            index: true,                          // DB index for fast lookups by operator
        },

        // Airline name stored directly (denormalized) so we don't need to
        // populate/join the User collection every time we display a flight.
        operatorName: {
            type: String,
            required: true,
            trim: true, // Removes surrounding whitespace: "  IndiGo  " → "IndiGo"
        },

        // ── Aircraft Identity ────────────────────────────────────────────────

        // The airline's name for this flight service (e.g., "IndiGo Express")
        airlineName: {
            type: String,
            required: true,
            trim: true,
        },

        // The IATA flight number (e.g., "6E-204", "AI-101")
        // This is the code passengers look up on departure boards.
        flightNumber: {
            type: String,
            required: true,
            unique: true,     // No two flights can share the same number
            uppercase: true,  // Auto-converts "6e-204" → "6E-204" before saving
            trim: true,
        },

        // The physical aircraft's registration (tail number), e.g., "VT-IGP"
        // Government-issued, must be globally unique
        registrationNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        // ── Aircraft Configuration ───────────────────────────────────────────

        // The aircraft model/type (e.g., "BOEING_737", "AIRBUS_A320")
        // `enum` restricts values to this predefined list
        aircraftType: {
            type: String,
            enum: [
                "AIRBUS_A320",    // Common narrow-body (IndiGo, SpiceJet)
                "AIRBUS_A321",    // Stretched A320 variant
                "BOEING_737",     // Classic narrow-body (Southwest, many LCCs)
                "BOEING_777",     // Wide-body, used for long-haul
                "BOEING_787",     // Dreamliner — premium long-haul
                "ATR_72",         // Turboprop for shorter regional routes
                "EMBRAER_E175",   // Regional jet
            ],
            required: true,
        },

        // The cabin class configuration of this aircraft
        // Most aircraft have a single class (ECONOMY) or two (ECONOMY + BUSINESS)
        classType: {
            type: String,
            enum: [
                "ECONOMY",           // Standard class
                "BUSINESS",          // Premium seats
                "FIRST",             // First class (rare on domestic)
                "ECONOMY_BUSINESS",  // Dual-class aircraft
                "ECONOMY_FIRST",     // Economy + First
                "ALL_CLASSES",       // Full three-class cabin
            ],
            required: true,
        },

        // ── Seat Counts ──────────────────────────────────────────────────────

        // Total number of bookable seats across all cabin classes
        totalSeats: {
            type: Number,
            required: true,
            min: 1,
        },

        // Breakdown by class (optional — for aircraft with multiple classes)
        economySeats: {
            type: Number,
            default: 0,
        },

        businessSeats: {
            type: Number,
            default: 0,
        },

        firstClassSeats: {
            type: Number,
            default: 0,
        },

        // ── Seat Layout Blueprint ────────────────────────────────────────────
        // This is the per-seat map of the aircraft.
        // Each element represents ONE physical seat with its class and position.
        //
        // IMPORTANT: When a FlightSchedule is created, this entire array is
        // COPIED into the schedule's `seats` field. This creates an independent
        // snapshot so booking seat 3A on Monday doesn't affect Tuesday.
        seatLayout: [
            {
                // Seat identifier (e.g., "3A", "12C", "1B")
                // Standard format: row number + column letter
                seatNumber: {
                    type: String,
                    required: true,
                },

                // Which cabin class does this seat belong to?
                cabinClass: {
                    type: String,
                    enum: ["ECONOMY", "BUSINESS", "FIRST"],
                    default: "ECONOMY",
                },

                // Is this a window, aisle, or middle seat?
                seatType: {
                    type: String,
                    enum: ["window", "aisle", "middle"],
                    default: "aisle",
                },

                // Row number (1 = front of the plane, higher = back)
                row: {
                    type: Number,
                    required: true,
                },

                // Column letter encoded as a string ("A", "B", "C", "D", "E", "F")
                column: {
                    type: String,
                    required: true,
                },

                // Does this seat have extra legroom?
                isExtraLegroom: {
                    type: Boolean,
                    default: false,
                },

                // Base fare for this specific seat.
                // Window seats and exit row seats often cost extra.
                fare: {
                    type: Number,
                    default: 0,
                },
            },
        ],

        // ── Feature Flags ────────────────────────────────────────────────────
        // Boolean flags for quick filter queries on search

        // Does this flight offer a dedicated business class?
        hasBusinessClass: {
            type: Boolean,
            default: false,
        },

        // Does this flight offer a first class cabin?
        hasFirstClass: {
            type: Boolean,
            default: false,
        },

        // ── In-Flight Amenities ──────────────────────────────────────────────
        // What services are available on this aircraft?
        amenities: [
            {
                type: String,
                enum: [
                    "WiFi",            // Onboard internet
                    "Meal",            // Complimentary meal
                    "Snack",           // Light refreshments
                    "Entertainment",   // Seatback screens / streaming
                    "Power Outlet",    // In-seat charging
                    "USB Charging",    // USB charging port
                    "Extra Legroom",   // Available extra legroom seats
                    "Priority Boarding", // Early access to board
                ],
            },
        ],

        // ── Media ────────────────────────────────────────────────────────────
        // Photos of the aircraft cabin for the listing page
        photos: [
            {
                url: {
                    type: String, // URL to the photo
                },
                isPrimary: {
                    type: Boolean,  // The main thumbnail image
                    default: false,
                },
            },
        ],

        // ── Ratings ──────────────────────────────────────────────────────────
        // Aggregate rating computed whenever a new review is added
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5, // Star rating: 0–5
        },

        // Running count of total ratings submitted
        totalRatings: {
            type: Number,
            default: 0,
        },

        // ── Status ───────────────────────────────────────────────────────────
        // Current operational status of this aircraft
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE", // New aircraft default to ACTIVE
        },
    },
    {
        // Mongoose option: automatically add `createdAt` and `updatedAt` timestamps
        timestamps: true,
    }
);

// ── Compound Index ────────────────────────────────────────────────────────────
// Speeds up searches like "find all flights for airline X of type Y"
flightSchema.index({ operatorId: 1, aircraftType: 1 });

// Create the Mongoose model.
// "Flight" = model name → Mongoose auto-creates a "flights" collection in MongoDB.
export const Flight = mongoose.model("Flight", flightSchema);
