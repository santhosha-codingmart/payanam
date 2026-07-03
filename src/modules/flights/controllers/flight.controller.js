// ─────────────────────────────────────────────────────────────────────────────
// Flight Controller — The HTTP Bridge
// Controllers must be thin. Their ONLY job is to:
//   1. Extract data from the HTTP Request (req.body, req.params, req.query, req.user)
//   2. Call the appropriate Service function with that data
//   3. Format the Service's result into an HTTP Response (res.json)
//   4. Catch any errors and forward them to the global error handler (next)
//
// NO business logic lives here. All rules are in flight.service.js.
// ─────────────────────────────────────────────────────────────────────────────

import * as flightService from "../services/flight.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT CRUD (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/flights — Create a new aircraft
export const createFlight = async (req, res, next) => {
    try {
        // req.user._id is injected by the `authenticate` middleware (from JWT)
        // req.body has already been validated by the Zod `validate` middleware
        const flight = await flightService.createFlightService(req.user._id, req.body);

        // 201 Created — the standard HTTP status for a successful resource creation
        return res.status(201).json({
            success: true,
            message: "Flight created successfully.",
            data: flight,
        });
    } catch (error) {
        // next(error) delegates to Express's global error handler middleware
        next(error);
    }
};

// GET /api/v1/flights — List all flights owned by the logged-in vendor
export const getVendorFlights = async (req, res, next) => {
    try {
        // Only returns flights where operatorId === req.user._id
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

// GET /api/v1/flights/:id — Get a specific flight by ID
export const getFlightById = async (req, res, next) => {
    try {
        // req.params.id is the dynamic segment from the URL: /flights/:id
        const flight = await flightService.getFlightByIdService(req.params.id);

        return res.status(200).json({
            success: true,
            data: flight,
        });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/v1/flights/:id — Partially update a flight (owner only)
export const updateFlight = async (req, res, next) => {
    try {
        const flight = await flightService.updateFlightService(
            req.params.id,
            req.user._id, // Passed to service so it can verify ownership
            req.body
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

// DELETE /api/v1/flights/:id — Delete a flight + cascade-delete routes & schedules
export const deleteFlight = async (req, res, next) => {
    try {
        await flightService.deleteFlightService(req.params.id, req.user._id);

        return res.status(200).json({
            success: true,
            message: "Flight and all associated routes and schedules deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT ROUTE (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/flights/routes — Create a new route for an aircraft
export const createFlightRoute = async (req, res, next) => {
    try {
        const route = await flightService.createFlightRouteService(req.user._id, req.body);

        return res.status(201).json({
            success: true,
            message: "Route created successfully.",
            data: route,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/flights/:id/routes — Get all routes for a specific aircraft
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

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT SCHEDULE (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/flights/schedules — Create a new scheduled trip
export const createFlightSchedule = async (req, res, next) => {
    try {
        const schedule = await flightService.createFlightScheduleService(req.user._id, req.body);

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
        const schedules = await flightService.getVendorFlightSchedulesService(req.user._id);

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
        const schedule = await flightService.getFlightScheduleByIdService(req.params.scheduleId);
        
        return res.status(200).json({
            success: true,
            message: "Schedule fetched successfully.",
            data: schedule,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/flights/schedules/:scheduleId/seats — View the seat map for a trip
export const getFlightScheduleSeats = async (req, res, next) => {
    try {
        const seatData = await flightService.getFlightScheduleSeatsService(req.params.scheduleId);

        return res.status(200).json({
            success: true,
            message: "Seat layout fetched successfully.",
            data: seatData,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (Public — no auth required)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/flights/search?from=DEL&to=BOM&date=2026-07-01
export const searchFlights = async (req, res, next) => {
    try {
        // Destructure the known params; spread remaining into `filters`
        // E.g., ?from=DEL&to=BOM&date=2026-07-01&sortBy=price_low&maxPrice=5000
        const { from, to, date, ...filters } = req.query;

        const results = await flightService.searchFlightsService(from, to, date, filters);

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

// ─────────────────────────────────────────────────────────────────────────────
// SEAT BLOCKING (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/flights/schedules/:scheduleId/block-seats
export const blockSeats = async (req, res, next) => {
    try {
        const { scheduleId } = req.params;
        const { seatNumbers } = req.body;
        const userId = req.user._id; // Requires authentication

        const result = await flightService.blockSeatsService(userId, scheduleId, seatNumbers);

        return res.status(200).json({
            success: true,
            message: result.message,
            expiresAt: result.expiresAt,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE CANCEL (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

// PATCH /api/v1/flights/schedules/:scheduleId/cancel
export const cancelFlightSchedule = async (req, res, next) => {
    try {
        const result = await flightService.cancelFlightScheduleService(
            req.user._id,        // vendor's operatorId from JWT
            req.params.scheduleId
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                scheduleId:        result.scheduleId,
                cancelledBookings: result.cancelledBookings,
            },
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS AND RATINGS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/flights/:flightId/reviews
export const addFlightReview = async (req, res, next) => {
    try {
        const { flightId } = req.params;
        const { bookingId, rating, review } = req.body;
        const userId = req.user._id;

        const result = await flightService.addFlightReviewService(
            userId, flightId, bookingId, rating, review
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
