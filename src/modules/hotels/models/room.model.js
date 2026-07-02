import mongoose from "mongoose";

const roomSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true,
            index: true,
        },
        roomType: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        pricePerNight: {
            type: Number,
            required: true,
            min: 0,
        },
        capacity: {
            adults: {
                type: Number,
                required: true,
                min: 1,
            },
            children: {
                type: Number,
                required: true,
                default: 0,
                min: 0,
            },
        },
        totalRooms: {
            type: Number,
            required: true,
            min: 1,
            description: "Total inventory of this specific room type.",
        },
        amenities: [
            {
                type: String,
                trim: true,
            },
        ],
        bedType: {
            type: String,
            enum: ["Twin", "Double", "Queen", "King"],
            required: true,
        },
        images: [
            {
                type: String, // URLs to images
            },
        ],
        status: {
            type: String,
            enum: ["AVAILABLE", "UNAVAILABLE"],
            default: "AVAILABLE",
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("Room", roomSchema);
