import mongoose from "mongoose";

const hotelBookingSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true,
            index: true,
        },
        roomId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Room",
            required: true,
            index: true,
        },
        checkInDate: {
            type: Date,
            required: true,
            index: true,
        },
        checkOutDate: {
            type: Date,
            required: true,
            index: true,
        },
        numRooms: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        totalGuests: {
            adults: { type: Number, required: true },
            children: { type: Number, default: 0 },
        },
        guestDetails: [
            {
                name: { type: String, required: true },
                age: { type: Number, required: true },
            },
        ],
        totalPrice: {
            type: Number,
            required: true,
        },
        status: {
            type: String,
            enum: ["PENDING", "CONFIRMED", "CANCELLED"],
            default: "PENDING",
        },
        paymentReference: {
            type: String, // Mock payment gateway reference
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model("HotelBooking", hotelBookingSchema);
