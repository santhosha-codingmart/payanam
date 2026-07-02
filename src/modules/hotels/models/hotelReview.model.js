import mongoose from "mongoose";

const hotelReviewSchema = new mongoose.Schema(
    {
        hotelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hotel",
            required: true,
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "HotelBooking",
            required: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        status: {
            type: String,
            enum: ["APPROVED", "PENDING", "REJECTED"],
            default: "APPROVED", // Auto-approved for now
        },
    },
    {
        timestamps: true,
    }
);

// Prevent multiple reviews for the same booking
hotelReviewSchema.index({ bookingId: 1 }, { unique: true });

hotelReviewSchema.statics.calculateAverageRating = async function (hotelId) {
    const stats = await this.aggregate([
        {
            $match: { hotelId, status: "APPROVED" },
        },
        {
            $group: {
                _id: "$hotelId",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    if (stats.length > 0) {
        await mongoose.model("Hotel").findByIdAndUpdate(hotelId, {
            averageRating: Math.round(stats[0].averageRating * 10) / 10,
            totalReviews: stats[0].totalReviews,
        });
    } else {
        await mongoose.model("Hotel").findByIdAndUpdate(hotelId, {
            averageRating: 0,
            totalReviews: 0,
        });
    }
};

// Call calculateAverageRating after a new review is saved
hotelReviewSchema.post("save", function () {
    this.constructor.calculateAverageRating(this.hotelId);
});

// Call calculateAverageRating if a review is updated or deleted
hotelReviewSchema.post(/^findOneAnd/, async function (doc) {
    if (doc) {
        await doc.constructor.calculateAverageRating(doc.hotelId);
    }
});

export default mongoose.model("HotelReview", hotelReviewSchema);
