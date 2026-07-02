import * as hotelService from "../services/hotel.service.js";
import { uploadFileToS3 } from "../../../utils/s3.service.js";

// ── VENDOR OPERATIONS ────────────────────────────────────────────────────────

export const createHotel = async (req, res, next) => {
    try {
        const operatorId = req.user._id; 
        const hotelData = req.body;

        // If files were uploaded, send them to S3
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) => 
                uploadFileToS3(file.buffer, file.originalname, file.mimetype, "hotels")
            );
            const imageUrls = await Promise.all(uploadPromises);
            
            // If there were existing string URLs in req.body.images, we merge them
            const existingImages = Array.isArray(hotelData.images) ? hotelData.images : 
                                   (hotelData.images ? [hotelData.images] : []);
            hotelData.images = [...existingImages, ...imageUrls];
        }

        const hotel = await hotelService.createHotelService(operatorId, hotelData);
        res.status(201).json({ success: true, data: hotel, message: "Hotel created successfully." });
    } catch (error) {
        next(error);
    }
};

export const getVendorHotels = async (req, res, next) => {
    try {
        const operatorId = req.user._id;
        const hotels = await hotelService.getVendorHotelsService(operatorId);
        res.status(200).json({ success: true, data: hotels, message: "Vendor hotels retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

export const getHotelById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const hotel = await hotelService.getHotelByIdService(id);
        res.status(200).json({ success: true, data: hotel, message: "Hotel retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

export const updateHotel = async (req, res, next) => {
    try {
        const { id } = req.params;
        const operatorId = req.user._id;
        const updateData = req.body;

        // If files were uploaded, send them to S3
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map((file) => 
                uploadFileToS3(file.buffer, file.originalname, file.mimetype, "hotels")
            );
            const imageUrls = await Promise.all(uploadPromises);
            
            const existingImages = Array.isArray(updateData.images) ? updateData.images : 
                                   (updateData.images ? [updateData.images] : []);
            updateData.images = [...existingImages, ...imageUrls];
        }

        const hotel = await hotelService.updateHotelService(id, operatorId, updateData);
        res.status(200).json({ success: true, data: hotel, message: "Hotel updated successfully." });
    } catch (error) {
        next(error);
    }
};

export const createRoom = async (req, res, next) => {
    try {
        const { hotelId } = req.params;
        const operatorId = req.user._id;
        const roomData = req.body;

        const room = await hotelService.createRoomService(hotelId, operatorId, roomData);
        res.status(201).json({ success: true, data: room, message: "Room added successfully." });
    } catch (error) {
        next(error);
    }
};

export const getHotelRooms = async (req, res, next) => {
    try {
        const { hotelId } = req.params;
        const rooms = await hotelService.getRoomsByHotelService(hotelId);
        res.status(200).json({ success: true, data: rooms, message: "Rooms retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

// ── PUBLIC OPERATIONS ────────────────────────────────────────────────────────

export const searchHotels = async (req, res, next) => {
    try {
        const searchResults = await hotelService.searchHotelsService(req.query);
        res.status(200).json({ success: true, data: searchResults, message: `Found ${searchResults.hotels.length} hotels matching your criteria.` });
    } catch (error) {
        next(error);
    }
};

export const getHotelDetailsAggregated = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { checkInDate, checkOutDate, adults } = req.query;
        
        const aggregatedDetails = await hotelService.getHotelDetailsAggregatedService(id, checkInDate, checkOutDate, adults);
        res.status(200).json({ success: true, data: aggregatedDetails, message: "Aggregated hotel details retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

// ── USER BOOKING OPERATIONS ──────────────────────────────────────────────────

export const createBooking = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const bookingData = req.body;
        
        const booking = await hotelService.createHotelBookingService(userId, bookingData);
        res.status(201).json({ success: true, data: booking, message: "Hotel booked successfully." });
    } catch (error) {
        next(error);
    }
};

export const getUserBookings = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const bookings = await hotelService.getUserHotelBookingsService(userId);
        res.status(200).json({ success: true, data: bookings, message: "Hotel bookings retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

export const cancelBooking = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { bookingId } = req.params;
        
        const booking = await hotelService.cancelHotelBookingService(userId, bookingId);
        res.status(200).json({ success: true, data: booking, message: "Hotel booking cancelled successfully." });
    } catch (error) {
        next(error);
    }
};

// ── REVIEWS ──────────────────────────────────────────────────────────────────

export const getHotelReviews = async (req, res, next) => {
    try {
        const { hotelId } = req.params;
        const reviews = await hotelService.getHotelReviewsService(hotelId);
        res.status(200).json({ success: true, data: reviews, message: "Reviews retrieved successfully." });
    } catch (error) {
        next(error);
    }
};

export const addHotelReview = async (req, res, next) => {
    try {
        const { hotelId } = req.params;
        const userId = req.user._id;
        const reviewData = req.body;
        
        const review = await hotelService.addHotelReviewService(userId, hotelId, reviewData);
        res.status(201).json({ success: true, data: review, message: "Review added successfully." });
    } catch (error) {
        next(error);
    }
};
