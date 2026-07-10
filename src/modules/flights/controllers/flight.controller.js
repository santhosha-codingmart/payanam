import * as flightService from "../services/flight.service.js";

export const createFlight = async (req, res, next) => {
  try {
    const flight = await flightService.createFlightService(
      req.user._id,
      req.body,
    );
    return res.status(201).json({
      success: true,
      message: "Flight created successfully.",
      data: flight,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorFlights = async (req, res, next) => {
  try {
    const flights = await flightService.getVendorFlightsService(req.user._id);
    return res.status(200).json({
      success: true,
      message: "Flights fetched successfully.",
      count: flights.length,
      data: flights,
    });
  } catch (error) {
    next(error);
  }
};

export const getFlightById = async (req, res, next) => {
  try {
    const flight = await flightService.getFlightByIdService(req.params.id);
    return res.status(200).json({
      success: true,
      data: flight,
    });
  } catch (error) {
    next(error);
  }
};

export const updateFlight = async (req, res, next) => {
  try {
    const flight = await flightService.updateFlightService(
      req.params.id,
      req.user._id,
      req.body,
    );
    return res.status(200).json({
      success: true,
      message: "Flight updated successfully.",
      data: flight,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteFlight = async (req, res, next) => {
  try {
    await flightService.deleteFlightService(req.params.id, req.user._id);
    return res.status(200).json({
      success: true,
      message:
        "Flight and all associated routes and schedules deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};

export const createFlightRoute = async (req, res, next) => {
  try {
    const route = await flightService.createFlightRouteService(
      req.user._id,
      req.body,
    );
    return res.status(201).json({
      success: true,
      message: "Route created successfully.",
      data: route,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoutesForFlight = async (req, res, next) => {
  try {
    const routes = await flightService.getRoutesForFlightService(req.params.id);
    return res.status(200).json({
      success: true,
      count: routes.length,
      data: routes,
    });
  } catch (error) {
    next(error);
  }
};

export const createFlightSchedule = async (req, res, next) => {
  try {
    const schedule = await flightService.createFlightScheduleService(
      req.user._id,
      req.body,
    );
    return res.status(201).json({
      success: true,
      message: "Schedule created successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

export const getVendorFlightSchedules = async (req, res, next) => {
  try {
    const schedules = await flightService.getVendorFlightSchedulesService(
      req.user._id,
    );
    return res.status(200).json({
      success: true,
      message: "Schedules fetched successfully.",
      count: schedules.length,
      data: schedules,
    });
  } catch (error) {
    next(error);
  }
};

export const getFlightScheduleById = async (req, res, next) => {
  try {
    const schedule = await flightService.getFlightScheduleByIdService(
      req.params.scheduleId,
    );
    return res.status(200).json({
      success: true,
      message: "Schedule fetched successfully.",
      data: schedule,
    });
  } catch (error) {
    next(error);
  }
};

export const getFlightScheduleSeats = async (req, res, next) => {
  try {
    const seatData = await flightService.getFlightScheduleSeatsService(
      req.params.scheduleId,
    );
    return res.status(200).json({
      success: true,
      message: "Seat layout fetched successfully.",
      data: seatData,
    });
  } catch (error) {
    next(error);
  }
};

export const searchFlights = async (req, res, next) => {
  try {
    const { from, to, date, ...filters } = req.query;
    const results = await flightService.searchFlightsService(
      from,
      to,
      date,
      filters,
    );
    return res.status(200).json({
      success: true,
      message:
        results.length > 0
          ? `Found ${results.length} flight(s) from ${from} to ${to}.`
          : `No flights found from ${from} to ${to} on ${date}.`,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

export const blockSeats = async (req, res, next) => {
  try {
    const { scheduleId } = req.params;
    const { seatNumbers } = req.body;
    const userId = req.user._id;
    const result = await flightService.blockSeatsService(
      userId,
      scheduleId,
      seatNumbers,
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelFlightSchedule = async (req, res, next) => {
  try {
    const result = await flightService.cancelFlightScheduleService(
      req.user._id,
      req.params.scheduleId,
    );
    return res.status(200).json({
      success: true,
      message: result.message,
      data: {
        scheduleId: result.scheduleId,
        cancelledBookings: result.cancelledBookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addFlightReview = async (req, res, next) => {
  try {
    const { flightId } = req.params;
    const { bookingId, rating, review } = req.body;
    const userId = req.user._id;
    const result = await flightService.addFlightReviewService(
      userId,
      flightId,
      bookingId,
      rating,
      review,
    );
    return res.status(201).json({
      success: true,
      message: "Review added successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const createFlightBooking = async (req, res, next) => {
  try {
    const booking = await flightService.createFlightBookingService(
      req.user._id,
      req.body,
    );
    return res.status(201).json({
      success: true,
      message: `Flight booking confirmed! Your PNR is ${booking.bookingId}.`,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};
