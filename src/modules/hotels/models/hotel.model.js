import mongoose from "mongoose";

const hotelSchema = new mongoose.Schema(
    {
        operatorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        address: {
            type: String,
            required: true,
        },
        city: {
            type: String,
            required: true,
            index: true,
        },
        state: {
            type: String,
            required: true,
        },
        country: {
            type: String,
            default: "India",
        },
        starRating: {
            type: Number,
            enum: [1, 2, 3, 4, 5],
            required: true,
        },
        amenities: [
            {
                type: String,
                trim: true,
            },
        ],
        checkInTime: {
            type: String,
            required: true,
            default: "14:00",
        },
        checkOutTime: {
            type: String,
            required: true,
            default: "11:00",
        },
        images: [
            {
                type: String, // URLs to images
            },
        ],
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
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

// Optional: Compound index for search performance
hotelSchema.index({ city: 1, status: 1, averageRating: -1 });

export default mongoose.model("Hotel", hotelSchema);
