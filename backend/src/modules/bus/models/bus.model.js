import mongoose from "mongoose";

const busSchema = new mongoose.Schema(
    {
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        operatorName: {
            type: String,
            required: true,
            trim: true,
        },

        busName: {
            type: String,
            required: true,
            trim: true,
        },

        busNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        registrationNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        busType: {
            type: String,
            enum: [
                "AC_SLEEPER",
                "NON_AC_SLEEPER",
                "AC_SEATER",
                "NON_AC_SEATER",
                "VOLVO_AC",
                "SEMI_SLEEPER",
                "LUXURY_SLEEPER",
            ],
            required: true,
        },

        seatLayoutType: {
            type: String,
            enum: [
                "2+1_SLEEPER",
                "2+2_SEATER",
                "1+1_SLEEPER",
                "2+1_SEATER",
            ],
            required: true,
        },

        totalSeats: {
            type: Number,
            required: true,
            min: 1,
        },

        lowerDeckSeats: {
            type: Number,
            default: 0,
        },

        upperDeckSeats: {
            type: Number,
            default: 0,
        },

        sleeperSeats: {
            type: Number,
            default: 0,
        },

        seaterSeats: {
            type: Number,
            default: 0,
        },

        // The actual seat-by-seat blueprint — each seat defined individually
        // This is copied into schedules when a trip is created
        seatLayout: [
            {
                seatNumber: {
                    type: String,
                    required: true,
                },
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
                row: {
                    type: Number,
                    required: true,
                },
                column: {
                    type: Number,
                    required: true,
                },
                isSleeper: {
                    type: Boolean,
                    default: false,
                },
                fare: {
                    type: Number,
                    default: 0,
                },
            },
        ],

        isAC: {
            type: Boolean,
            default: false,
        },

        isSleeper: {
            type: Boolean,
            default: false,
        },

        isSeater: {
            type: Boolean,
            default: false,
        },

        amenities: [
            {
                type: String,
                enum: [
                    "WiFi",
                    "Charging Point",
                    "Blanket",
                    "Water Bottle",
                    "Reading Light",
                    "GPS Tracking",
                    "Emergency Exit",
                    "CCTV",
                ],
            },
        ],

        photos: [
            {
                url: {
                    type: String,
                },
                isPrimary: {
                    type: Boolean,
                    default: false,
                },
            },
        ],

        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },

        totalRatings: {
            type: Number,
            default: 0,
        },

        isGPSAvailable: {
            type: Boolean,
            default: false,
        },

        isLiveTrackingEnabled: {
            type: Boolean,
            default: false,
        },

        status: {
            type: String,
            enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"],
            default: "ACTIVE",
        },
    },
    {
        timestamps: true,
    }
);

export const Bus = mongoose.model("Bus", busSchema);