import * as busService from "../services/bus.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// BUS CRUD (vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createBus = async (req, res, next) => {
    try {
        const bus = await busService.createBusService(req.user._id, req.body);

        return res.status(201).json({
            success: true,
            message: "Bus created successfully.",
            data: bus,
        });
    } catch (error) {
        next(error);
    }
};

export const getVendorBuses = async (req, res, next) => {
    try {
        const buses = await busService.getVendorBusesService(req.user._id);

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
            req.user._id,
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
// ROUTE (vendor-only)
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
// SCHEDULE (vendor-only)
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
// SEARCH (public)
// ─────────────────────────────────────────────────────────────────────────────

export const searchBuses = async (req, res, next) => {
    try {
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