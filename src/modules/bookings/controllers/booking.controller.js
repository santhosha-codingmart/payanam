// =============================================================================
// Booking Controller — The HTTP Bridge
//
// WHY THIS FILE IS THIN:
// Controllers have ONE job: bridge the HTTP layer and the service layer.
//   1. Extract data from req (params, body, user)
//   2. Call the appropriate service function
//   3. Format the result into an HTTP response (res.json)
//   4. Pass any errors to next() for the global error handler
//
// If you find yourself writing DB queries or business logic in a controller,
// move it to the service layer immediately.
// =============================================================================

import * as bookingService from "../services/booking.service.js";

// =============================================================================
// POST /api/v1/bookings
// Creates a new confirmed booking after verifying the Redis seat lock.
// =============================================================================
export const createBooking = async (req, res, next) => {
    try {
        // req.user is attached by the `authenticate` middleware (JWT verification)
        // req.body has already been validated by Zod via the validate middleware
        const booking = await bookingService.createBookingService(
            req.user._id,
            req.body
        );

        // 201 Created is the standard status for a new resource
        return res.status(201).json({
            success: true,
            message: `Booking confirmed! Your PNR is ${booking.bookingId}.`,
            data: booking,
        });
    } catch (error) {
        // Pass to the global error handler (error.middleware.js)
        next(error);
    }
};

// =============================================================================
// GET /api/v1/bookings/:bookingId
// Fetches a single booking with full populated details (ticket view).
// =============================================================================
export const getBookingById = async (req, res, next) => {
    try {
        // bookingId is our custom "PAY-A3F2B1" string, extracted from the URL
        const booking = await bookingService.getBookingByIdService(
            req.user._id,
            req.params.bookingId
        );

        return res.status(200).json({
            success: true,
            data: booking,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// GET /api/v1/bookings/my-bookings
// Returns all bookings for the authenticated user ("My Trips" page).
// =============================================================================
export const getMyBookings = async (req, res, next) => {
    try {
        const bookings = await bookingService.getMyBookingsService(req.user._id);

        return res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// POST /api/v1/bookings/:bookingId/cancel
// Cancels a confirmed booking and calculates the applicable refund.
// =============================================================================
export const cancelBooking = async (req, res, next) => {
    try {
        const result = await bookingService.cancelBookingService(
            req.user._id,
            req.params.bookingId
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                bookingId: result.bookingId,
                refundAmount: result.refundAmount,
                cancelledAt: result.cancelledAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// GET /api/v1/bookings/vendor-bookings
// Returns all bookings on the vendor's own buses (vendor dashboard view).
// Only accessible by role === "vendor". Supports filters + pagination.
// =============================================================================
export const getVendorBookings = async (req, res, next) => {
    try {
        // req.user._id IS the operatorId stored on every Booking the vendor owns.
        // req.query passes ?status=, ?scheduleId=, ?page=, ?limit= to the service.
        const result = await bookingService.getVendorBookingsService(
            req.user._id,
            req.query
        );

        return res.status(200).json({
            success: true,
            data: result.bookings,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// GET /api/v1/bookings/:bookingId/download-ticket
// Generates and streams a PDF ticket for a confirmed booking.
// =============================================================================
export const downloadTicket = async (req, res, next) => {
    try {
        const { pdfBuffer, bookingId } = await bookingService.downloadTicketService(
            req.user._id,
            req.params.bookingId
        );

        // Stream the PDF directly to the client as a file download
        res.set({
            "Content-Type":        "application/pdf",
            "Content-Disposition": `attachment; filename="Payanam-Ticket-${bookingId}.pdf"`,
            "Content-Length":      pdfBuffer.length,
            "Cache-Control":       "no-store",
        });
        return res.end(pdfBuffer);
    } catch (error) {
        next(error);
    }
};
