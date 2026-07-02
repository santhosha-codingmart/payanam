// ─────────────────────────────────────────────────────────────────────────────
// Bus Controller — The HTTP Bridge
// Controllers should be extremely thin. Their ONLY job is to:
// 1. Extract data from the incoming HTTP Request (`req`)
// 2. Pass that data to the Service layer to do the actual work
// 3. Take the result from the Service and format it into an HTTP Response (`res`)
// 4. Catch any errors and pass them to the global error handler (`next`)
// ─────────────────────────────────────────────────────────────────────────────

import * as busService from "../services/bus.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// BUS CRUD (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createBus = async (req, res, next) => {
    try {
        // req.user._id comes from the `authenticate` middleware
        // req.body comes from the user (and is already validated by Zod)
        const bus = await busService.createBusService(req.user._id, req.body);

        // 201 Created is the standard HTTP status for a successful POST
        return res.status(201).json({
            success: true,
            message: "Bus created successfully.",
            data: bus,
        });
    } catch (error) {
        // next(error) passes the error down the Express middleware chain
        // until it hits our global error handler in `error.middleware.js`
        next(error);
    }
};

export const getVendorBuses = async (req, res, next) => {
    try {
        // Vendors can only see their own buses.
        // We pass req.query to support filtering by search, busType, from, and to.
        const buses = await busService.getVendorBusesService(req.user._id, req.query);

        return res.status(200).json({
            success: true,
            message: "Buses fetched successfully.",
            count: buses.length,
            data: buses,
        });
    } catch (error) {
        next(error);
    }
};

export const getBusById = async (req, res, next) => {
    try {
        // req.params.id comes from the URL path: /api/v1/buses/:id
        const bus = await busService.getBusByIdService(req.params.id);

        return res.status(200).json({
            success: true,
            data: bus,
        });
    } catch (error) {
        next(error);
    }
};

export const updateBus = async (req, res, next) => {
    try {
        const bus = await busService.updateBusService(
            req.params.id,
            req.user._id, // Pass user ID so service can check ownership
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Bus updated successfully.",
            data: bus,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteBus = async (req, res, next) => {
    try {
        await busService.deleteBusService(req.params.id, req.user._id);

        return res.status(200).json({
            success: true,
            message: "Bus and its associated routes and schedules deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createRoute = async (req, res, next) => {
    try {
        const route = await busService.createRouteService(req.user._id, req.body);

        return res.status(201).json({
            success: true,
            message: "Route created successfully.",
            data: route,
        });
    } catch (error) {
        next(error);
    }
};

export const getRoutesForBus = async (req, res, next) => {
    try {
        const routes = await busService.getRoutesForBusService(req.params.id);

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
// SCHEDULE (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createSchedule = async (req, res, next) => {
    try {
        const schedule = await busService.createScheduleService(req.user._id, req.body);

        return res.status(201).json({
            success: true,
            message: "Schedule created successfully.",
            data: schedule,
        });
    } catch (error) {
        next(error);
    }
};

export const getVendorSchedules = async (req, res, next) => {
    try {
        const schedules = await busService.getVendorSchedulesService(req.user._id);

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

// Gets the full seat map for the frontend to render the bus layout
export const getScheduleSeats = async (req, res, next) => {
    try {
        const seatData = await busService.getScheduleSeatsService(req.params.scheduleId);

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
// SEARCH (Public — No auth required)
// ─────────────────────────────────────────────────────────────────────────────

export const searchBuses = async (req, res, next) => {
    try {
        // req.query pulls parameters from the URL
        // E.g., /search?from=Chennai&to=Bangalore&date=2026-06-25&isAC=true
        // The `...filters` syntax puts any extra params (like isAC, minPrice) into an object
        const { from, to, date, ...filters } = req.query;
        
        const results = await busService.searchBusesService(from, to, date, filters);

        return res.status(200).json({
            success: true,
            message:
                results.length > 0
                    ? `Found ${results.length} bus(es) from ${from} to ${to}.`
                    : `No buses found from ${from} to ${to} on ${date}.`,
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

export const blockSeats = async (req, res, next) => {
    try {
        const { scheduleId } = req.params;
        const { seatNumbers } = req.body;
        // User must be logged in, so req.user exists
        const userId = req.user._id;

        const result = await busService.blockSeatsService(userId, scheduleId, seatNumbers);

        return res.status(200).json({
            success: true,
            message: result.message,
            expiresAt: result.expiresAt
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS (Phase 5)
// ─────────────────────────────────────────────────────────────────────────────

export const addReview = async (req, res, next) => {
    try {
        const { busId } = req.params;
        const { bookingId, rating, review } = req.body;
        const userId = req.user._id;

        const result = await busService.addReviewService(userId, busId, bookingId, rating, review);

        return res.status(201).json({
            success: true,
            message: "Review added successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE CANCEL (Vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const cancelSchedule = async (req, res, next) => {
    try {
        const result = await busService.cancelScheduleService(
            req.user._id,           // vendor's operatorId from JWT
            req.params.scheduleId
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                scheduleId:       result.scheduleId,
                cancelledBookings: result.cancelledBookings,
            },
        });
    } catch (error) {
        next(error);
    }
};