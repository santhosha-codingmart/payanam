import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        busId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bus",
            required: true,
            index: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true, // One review per booking
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        review: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
    },
    { timestamps: true }
);

export const Review = mongoose.model("Review", reviewSchema);
