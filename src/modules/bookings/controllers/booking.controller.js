import * as bookingService from "../services/booking.service.js";

export const createBooking = async (req, res, next) => {
  try {
    const booking = await bookingService.createBookingService(
      req.user._id,
      req.body,
    );
    return res.status(201).json({
      success: true,
      message: `Booking confirmed! Your PNR is ${booking.bookingId}.`,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingByIdService(
      req.user._id,
      req.params.bookingId,
    );
    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

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

export const cancelBooking = async (req, res, next) => {
  try {
    const result = await bookingService.cancelBookingService(
      req.user._id,
      req.params.bookingId,
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

export const getVendorBookings = async (req, res, next) => {
  try {
    const result = await bookingService.getVendorBookingsService(
      req.user._id,
      req.query,
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

export const downloadTicket = async (req, res, next) => {
  try {
    const { pdfBuffer, bookingId } = await bookingService.downloadTicketService(
      req.user._id,
      req.params.bookingId,
    );
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payanam-Ticket-${bookingId}.pdf"`,
      "Content-Length": pdfBuffer.length,
      "Cache-Control": "no-store",
    });
    return res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
