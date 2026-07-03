// ─────────────────────────────────────────────────────────────────────────────
// Bus Model — The physical bus entity (vehicle)
// This represents a real-world bus owned by a vendor/operator.
// It stores the bus's fixed properties like seats, type, and amenities.
// Think of this as the "template" — it doesn't change from trip to trip.
// ─────────────────────────────────────────────────────────────────────────────

// Mongoose is the ODM (Object-Document Mapper) for MongoDB.
// It lets us define schemas (structure) for our MongoDB documents.
import mongoose from "mongoose";

// Define the schema — this is the blueprint for every "Bus" document in MongoDB.
// Every field listed here will be stored in the "buses" collection.
const busSchema = new mongoose.Schema(
    {
        // ── Owner Reference ──────────────────────────────────────────────
        // Which vendor (user) owns this bus?
        // This is a "foreign key" pointing to the User collection.
        // We use this for ownership checks: "you can only edit YOUR buses"
        operatorId: {
            type: mongoose.Schema.Types.ObjectId, // MongoDB's special ID type (24-char hex string)
            ref: "User",                          // Tells Mongoose this points to the "User" model
            required: true,                       // Every bus MUST have an owner
            index: true,                          // Creates a DB index for fast lookups by operatorId
        },

        // ── Operator Display Name ────────────────────────────────────────
        // We store this separately (denormalized) so we don't need to
        // populate/join the User every time we display a bus.
        operatorName: {
            type: String,
            required: true,
            trim: true, // Removes whitespace from both ends: "  KPN  " → "KPN"
        },

        // ── Bus Identity ─────────────────────────────────────────────────
        // The name the operator gives to this bus service
        busName: {
            type: String,
            required: true,
            trim: true,
        },

        // Bus number — like a short code (e.g., "TN01KPN001")
        busNumber: {
            type: String,
            required: true,
            unique: true,      // No two buses can have the same number
            uppercase: true,   // Auto-converts "tn01kpn001" → "TN01KPN001" before saving
            trim: true,
        },

        // Vehicle registration number — government-issued plate number
        registrationNumber: {
            type: String,
            required: true,
            unique: true,      // Must be globally unique
            uppercase: true,   // Auto-uppercase
            trim: true,
        },

        // ── Bus Configuration ────────────────────────────────────────────

        // What type of bus is this? Restricted to a fixed set of values.
        // `enum` means only these exact strings are allowed — anything else fails validation.
        busType: {
            type: String,
            enum: [
                "AC_SLEEPER",       // Air-conditioned sleeper (flat beds)
                "NON_AC_SLEEPER",   // Sleeper without AC
                "AC_SEATER",        // AC with regular seats
                "NON_AC_SEATER",    // Basic bus with seats, no AC
                "VOLVO_AC",         // Premium Volvo bus
                "SEMI_SLEEPER",     // Reclinable seats (between seater and sleeper)
                "LUXURY_SLEEPER",   // Premium sleeper (wider beds, more space)
            ],
            required: true,
        },

        // How are the seats arranged? E.g., "2+1" means 2 seats on left, 1 on right
        seatLayoutType: {
            type: String,
            enum: [
                "2+1_SLEEPER",  // 2 beds left, 1 right (common in Indian sleeper buses)
                "2+2_SEATER",   // 2 seats left, 2 right (standard seating)
                "1+1_SLEEPER",  // 1 bed left, 1 right (luxury, more space)
                "2+1_SEATER",   // 2 seats left, 1 right (semi-luxury)
            ],
            required: true,
        },

        // ── Seat Counts ──────────────────────────────────────────────────
        // Total number of bookable seats
        totalSeats: {
            type: Number,
            required: true,
            min: 1, // A bus must have at least 1 seat
        },

        // How many seats are on the lower deck
        lowerDeckSeats: {
            type: Number,
            default: 0, // Default 0 — single-deck buses don't have this
        },

        // How many seats are on the upper deck
        upperDeckSeats: {
            type: Number,
            default: 0,
        },

        // How many of the seats are sleeper-type (flat beds)
        sleeperSeats: {
            type: Number,
            default: 0,
        },

        // How many of the seats are regular seating
        seaterSeats: {
            type: Number,
            default: 0,
        },

        // ── Seat Layout Blueprint ────────────────────────────────────────
        // This is the actual seat-by-seat map of the bus.
        // Each element represents ONE physical seat with its position and properties.
        //
        // IMPORTANT: When a schedule (trip) is created, this entire array is
        // COPIED into the schedule's `seats` field. This creates an independent
        // snapshot for each trip, so booking seat L1 on Monday's trip doesn't
        // affect Tuesday's trip.
        seatLayout: [
            {
                // Unique identifier for this seat (e.g., "L1", "U5", "S12")
                // L = lower deck, U = upper deck, S = seater
                seatNumber: {
                    type: String,
                    required: true,
                },
                // Is this seat by the window, on the aisle, or in the middle?
                seatType: {
                    type: String,
                    enum: ["window", "aisle", "middle"],
                    default: "aisle",
                },
                // Which deck is this seat on?
                deck: {
                    type: String,
                    enum: ["lower", "upper"],
                    default: "lower",
                },
                // Position in a grid layout (for rendering in the frontend)
                // Row 1 is the front of the bus, higher numbers are towards the back
                row: {
                    type: Number,
                    required: true,
                },
                // Column position (1=left window, 2=left aisle, 3=right aisle, 4=right window)
                column: {
                    type: Number,
                    required: true,
                },
                // Is this a flat sleeper bed or a regular seat?
                isSleeper: {
                    type: Boolean,
                    default: false,
                },
                // Base price for this specific seat
                // Window seats and lower deck often cost more
                fare: {
                    type: Number,
                    default: 0,
                },
            },
        ],

        // ── Feature Flags ────────────────────────────────────────────────
        // Boolean flags for quick filtering in search queries

        // Does this bus have air conditioning?
        isAC: {
            type: Boolean,
            default: false,
        },

        // Does this bus have sleeper berths?
        isSleeper: {
            type: Boolean,
            default: false,
        },

        // Does this bus have regular seats?
        isSeater: {
            type: Boolean,
            default: false,
        },

        // ── Amenities ────────────────────────────────────────────────────
        // List of amenities available on this bus.
        // Each item must be from the predefined enum list.
        amenities: [
            {
                type: String,
                enum: [
                    "WiFi",           // Onboard WiFi
                    "Charging Point", // USB/power charging
                    "Blanket",        // Blankets provided
                    "Water Bottle",   // Free water bottle
                    "Reading Light",  // Individual reading lights
                    "GPS Tracking",   // Real-time location tracking
                    "Emergency Exit", // Marked emergency exits
                    "CCTV",          // Security cameras
                ],
            },
        ],

        // ── Media ────────────────────────────────────────────────────────
        // Photos of the bus interior/exterior (for the listing page)
        photos: [
            {
                url: {
                    type: String, // URL to the image
                },
                isPrimary: {
                    type: Boolean,  // Which photo to show as the main thumbnail
                    default: false,
                },
            },
        ],

        // ── Ratings ──────────────────────────────────────────────────────
        // Average user rating (updated when reviews are submitted)
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5, // Star rating: 0 to 5
        },

        // How many users have rated this bus
        totalRatings: {
            type: Number,
            default: 0,
        },

        // ── Tracking Features ────────────────────────────────────────────
        // Does this bus have GPS hardware installed?
        isGPSAvailable: {
            type: Boolean,
            default: false,
        },

        // Is real-time tracking enabled for passengers?
        isLiveTrackingEnabled: {
            type: Boolean,
            default: false,
        },

        // ── Status ───────────────────────────────────────────────────────
        // Current operational status of the bus
        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"],
            default: "ACTIVE", // New buses start as ACTIVE
        },
    },
    {
        // Mongoose option: automatically add `createdAt` and `updatedAt` fields
        timestamps: true,
    }
);

// Create the Mongoose model from the schema.
// "Bus" = model name (Mongoose auto-creates a "buses" collection in MongoDB)
export const Bus = mongoose.model("Bus", busSchema);