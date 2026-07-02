import mongoose from "mongoose";
import Hotel from "../models/hotel.model.js";
import Room from "../models/room.model.js";
import HotelBooking from "../models/hotelBooking.model.js";
import HotelReview from "../models/hotelReview.model.js";
import { bulkUpsertCities } from "../../places/services/city.service.js";
import { ApiError } from "../../../utils/ApiError.js";

// ── VENDOR OPERATIONS ────────────────────────────────────────────────────────

export const createHotelService = async (operatorId, hotelData) => {
    const hotel = await Hotel.create({ ...hotelData, operatorId });

    // Auto-register city for search autocomplete
    if (hotel.city && hotel.state) {
        await bulkUpsertCities([{ name: hotel.city, state: hotel.state, country: hotel.country || "India" }]);
    }

    return hotel;
};

export const getVendorHotelsService = async (operatorId) => {
    return await Hotel.find({ operatorId }).sort({ createdAt: -1 });
};

export const getHotelByIdService = async (hotelId) => {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw new ApiError(404, "Hotel not found.");
    return hotel;
};

export const updateHotelService = async (hotelId, operatorId, updateData) => {
    const hotel = await Hotel.findById(hotelId);
    if (!hotel) throw new ApiError(404, "Hotel not found.");
    if (hotel.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You do not have permission to update this hotel.");
    }
    Object.assign(hotel, updateData);
    await hotel.save();

    // Auto-register city for search autocomplete if it was updated
    if (updateData.city || updateData.state) {
        await bulkUpsertCities([{ name: hotel.city, state: hotel.state, country: hotel.country || "India" }]);
    }

    return hotel;
};

// ── ROOM OPERATIONS ──────────────────────────────────────────────────────────

export const createRoomService = async (hotelId, operatorId, roomData) => {
    const hotel = await getHotelByIdService(hotelId);
    if (hotel.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You do not have permission to add rooms to this hotel.");
    }
    return await Room.create({ ...roomData, hotelId });
};

export const getRoomsByHotelService = async (hotelId) => {
    return await Room.find({ hotelId }).sort({ pricePerNight: 1 });
};

// ── PUBLIC OPERATIONS ────────────────────────────────────────────────────────

export const searchHotelsService = async (queryParms) => {
    const { 
        city, 
        checkInDate, 
        checkOutDate, 
        adults = 1, 
        children = 0,
        minPrice,
        maxPrice,
        starRating,
        sortBy,
        page = 1,
        limit = 10
    } = queryParms;

    if (!city) throw new ApiError(400, "City is required for search.");

    // Date validation
    let inDate, outDate;
    if (checkInDate && checkOutDate) {
        inDate = new Date(checkInDate);
        outDate = new Date(checkOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inDate < today) throw new ApiError(400, "Check-in date cannot be in the past.");
        if (inDate >= outDate) throw new ApiError(400, "Check-out date must be strictly after Check-in date.");
    }

    // Build Hotel Filter Query
    const hotelFilter = {
        city: new RegExp(`^${city}$`, "i"),
        status: "ACTIVE",
    };

    if (starRating) {
        hotelFilter.starRating = Number(starRating);
    }

    // Match hotels
    const hotels = await Hotel.find(hotelFilter).lean();

    if (!hotels.length) {
        return { hotels: [], pagination: { total: 0, page: 1, pages: 0 } };
    }

    const hotelIds = hotels.map((h) => h._id);

    // Build Room Filter Query
    const roomFilter = {
        hotelId: { $in: hotelIds },
        status: "AVAILABLE",
        "capacity.adults": { $gte: Number(adults) }
    };

    if (minPrice || maxPrice) {
        roomFilter.pricePerNight = {};
        if (minPrice) roomFilter.pricePerNight.$gte = Number(minPrice);
        if (maxPrice) roomFilter.pricePerNight.$lte = Number(maxPrice);
    }

    // Find rooms that match capacity & price requirements
    let rooms = await Room.find(roomFilter).lean();

    // Filter by availability if dates are provided
    if (inDate && outDate) {
        const overlappingBookings = await HotelBooking.aggregate([
            {
                $match: {
                    hotelId: { $in: hotelIds },
                    status: { $in: ["PENDING", "CONFIRMED"] },
                    $and: [
                        { checkInDate: { $lt: outDate } },
                        { checkOutDate: { $gt: inDate } }
                    ]
                }
            },
            {
                $group: {
                    _id: "$roomId",
                    bookedCount: { $sum: "$numRooms" }
                }
            }
        ]);

        const bookedMap = {};
        overlappingBookings.forEach(b => {
            bookedMap[b._id.toString()] = b.bookedCount;
        });

        // Filter out rooms where bookedCount >= totalRooms
        rooms = rooms.filter(room => {
            const booked = bookedMap[room._id.toString()] || 0;
            return (room.totalRooms - booked) > 0;
        });
    }

    if (!rooms.length) {
         return { hotels: [], pagination: { total: 0, page: 1, pages: 0 } };
    }

    // Group available rooms by hotel and find the starting price
    const hotelPrices = {};
    const availableHotelIds = new Set();
    
    rooms.forEach(room => {
        availableHotelIds.add(room.hotelId.toString());
        if (!hotelPrices[room.hotelId] || room.pricePerNight < hotelPrices[room.hotelId]) {
            hotelPrices[room.hotelId] = room.pricePerNight;
        }
    });

    // Filter hotels and format response
    let finalHotels = hotels
        .filter(hotel => availableHotelIds.has(hotel._id.toString()))
        .map(hotel => ({
            ...hotel,
            startingPrice: hotelPrices[hotel._id.toString()]
        }));

    // Sorting
    if (sortBy === "price_asc") {
        finalHotels.sort((a, b) => a.startingPrice - b.startingPrice);
    } else if (sortBy === "price_desc") {
        finalHotels.sort((a, b) => b.startingPrice - a.startingPrice);
    } else if (sortBy === "rating_desc") {
        finalHotels.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedHotels = finalHotels.slice(startIndex, startIndex + limitNum);

    return {
        hotels: paginatedHotels,
        pagination: {
            total: finalHotels.length,
            page: pageNum,
            pages: Math.ceil(finalHotels.length / limitNum)
        }
    };
};

export const getHotelDetailsAggregatedService = async (hotelId, checkInDate, checkOutDate, adults = 1) => {
    // 1. Fetch Hotel Metadata
    const hotel = await Hotel.findById(hotelId).lean();
    if (!hotel) throw new ApiError(404, "Hotel not found.");

    // 2. Fetch all Rooms for this hotel
    let rooms = await Room.find({ 
        hotelId, 
        status: "AVAILABLE",
        "capacity.adults": { $gte: Number(adults) } 
    }).lean();

    // 3. Filter Rooms by availability if dates are provided
    if (checkInDate && checkOutDate) {
        const inDate = new Date(checkInDate);
        const outDate = new Date(checkOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (inDate < today) throw new ApiError(400, "Check-in date cannot be in the past.");
        if (inDate >= outDate) throw new ApiError(400, "Check-out date must be strictly after Check-in date.");

        const overlappingBookings = await HotelBooking.aggregate([
            {
                $match: {
                    hotelId: mongoose.Types.ObjectId(hotelId),
                    status: { $in: ["PENDING", "CONFIRMED"] },
                    $and: [
                        { checkInDate: { $lt: outDate } },
                        { checkOutDate: { $gt: inDate } }
                    ]
                }
            },
            {
                $group: {
                    _id: "$roomId",
                    bookedCount: { $sum: "$numRooms" }
                }
            }
        ]);

        const bookedMap = {};
        overlappingBookings.forEach(b => {
            bookedMap[b._id.toString()] = b.bookedCount;
        });

        rooms = rooms.filter(room => {
            const booked = bookedMap[room._id.toString()] || 0;
            return (room.totalRooms - booked) > 0;
        });
    }

    // 4. Fetch Top Reviews
    const recentReviews = await HotelReview.find({ hotelId, status: "APPROVED" })
        .populate("userId", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    return {
        hotel,
        availableRooms: rooms,
        recentReviews
    };
};

// ── BOOKING OPERATIONS ───────────────────────────────────────────────────────

export const createHotelBookingService = async (userId, bookingData) => {
    const { hotelId, roomId, checkInDate, checkOutDate, numRooms = 1, totalGuests, guestDetails } = bookingData;
    
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (inDate < today) {
        throw new ApiError(400, "Check-in date cannot be in the past.");
    }
    if (inDate >= outDate) {
        throw new ApiError(400, "Check-out date must be strictly after Check-in date.");
    }

    const room = await Room.findById(roomId);
    if (!room || room.hotelId.toString() !== hotelId) {
        throw new ApiError(404, "Room not found in this hotel.");
    }

    // Check availability for the requested dates
    const overlappingBookings = await HotelBooking.aggregate([
        {
            $match: {
                roomId: room._id,
                status: { $in: ["PENDING", "CONFIRMED"] },
                $and: [
                    { checkInDate: { $lt: outDate } },
                    { checkOutDate: { $gt: inDate } }
                ]
            }
        },
        {
            $group: {
                _id: "$roomId",
                bookedCount: { $sum: "$numRooms" }
            }
        }
    ]);

    const bookedCount = overlappingBookings.length > 0 ? overlappingBookings[0].bookedCount : 0;
    
    if (room.totalRooms - bookedCount < numRooms) {
        throw new ApiError(400, "Not enough rooms available for the selected dates.");
    }

    // Calculate nights
    const diffTime = Math.abs(outDate - inDate);
    const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const totalPrice = room.pricePerNight * numRooms * nights;

    // Create booking
    const booking = await HotelBooking.create({
        userId,
        hotelId,
        roomId,
        checkInDate: inDate,
        checkOutDate: outDate,
        numRooms,
        totalGuests,
        guestDetails,
        totalPrice,
        status: "CONFIRMED", // Auto confirm for now, mock payment
        paymentReference: `HOTEL-PAY-${Date.now()}`
    });

    return booking;
};

export const getUserHotelBookingsService = async (userId) => {
    return await HotelBooking.find({ userId })
        .populate("hotelId", "name address city images")
        .populate("roomId", "roomType bedType")
        .sort({ createdAt: -1 });
};

export const cancelHotelBookingService = async (userId, bookingId) => {
    const booking = await HotelBooking.findOne({ _id: bookingId, userId });
    
    if (!booking) {
        throw new ApiError(404, "Booking not found or you do not have permission to cancel it.");
    }

    if (booking.status === "CANCELLED") {
        throw new ApiError(400, "Booking is already cancelled.");
    }

    // A real implementation would check cancellation policy deadlines here
    booking.status = "CANCELLED";
    await booking.save();

    return booking;
};

// ── REVIEW OPERATIONS ────────────────────────────────────────────────────────

export const addHotelReviewService = async (userId, hotelId, reviewData) => {
    const { bookingId, rating, comment } = reviewData;

    // Verify the user actually stayed at the hotel
    const booking = await HotelBooking.findOne({ _id: bookingId, userId, hotelId });
    if (!booking) {
        throw new ApiError(403, "You can only review hotels you have booked.");
    }

    if (booking.status !== "CONFIRMED") {
        throw new ApiError(400, "You can only review confirmed bookings.");
    }

    const existingReview = await HotelReview.findOne({ bookingId });
    if (existingReview) {
        throw new ApiError(400, "You have already submitted a review for this booking.");
    }

    const review = await HotelReview.create({
        hotelId,
        userId,
        bookingId,
        rating,
        comment,
    });

    // Optionally: Update the average rating on the Hotel document here

    return review;
};

export const getHotelReviewsService = async (hotelId) => {
    return await HotelReview.find({ hotelId, status: "APPROVED" })
        .populate("userId", "name")
        .sort({ createdAt: -1 });
};
