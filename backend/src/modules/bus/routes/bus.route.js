import express from "express";
import {
    createBus,
    getVendorBuses,
    getBusById,
    updateBus,
    deleteBus,
    createRoute,
    getRoutesForBus,
    createSchedule,
    getScheduleSeats,
    searchBuses,
} from "../controllers/bus.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
    createBusSchema,
    updateBusSchema,
    busIdParamSchema,
    createRouteSchema,
    createScheduleSchema,
    scheduleIdParamSchema,
    searchBusSchema,
} from "../validators/bus.validator.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth)
// ─────────────────────────────────────────────────────────────────────────────

// Search buses: GET /api/v1/buses/search?from=Chennai&to=Bangalore&date=2026-06-25
// Optional filters: busType, isAC, minPrice, maxPrice, sortBy (price_low/price_high/rating/departure)
router.get("/search", validate(searchBusSchema), searchBuses);

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED ROUTES (any logged-in user)
// ─────────────────────────────────────────────────────────────────────────────

// View seat layout for a schedule
router.get(
    "/schedules/:scheduleId/seats",
    authenticate,
    validate(scheduleIdParamSchema),
    getScheduleSeats
);

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR-ONLY ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// Create a new bus
router.post(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    validate(createBusSchema),
    createBus
);

// List all buses owned by the logged-in vendor
router.get(
    "/",
    authenticate,
    authorize("vendor", "admin"),
    getVendorBuses
);

// Get a specific bus by ID
router.get(
    "/:id",
    authenticate,
    validate(busIdParamSchema),
    getBusById
);

// Update a bus (must own it)
router.patch(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(updateBusSchema),
    updateBus
);

// Delete a bus + all its routes and schedules (must own it)
router.delete(
    "/:id",
    authenticate,
    authorize("vendor", "admin"),
    validate(busIdParamSchema),
    deleteBus
);

// Create a route for a bus
router.post(
    "/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(createRouteSchema),
    createRoute
);

// Get all routes for a specific bus
router.get(
    "/:id/routes",
    authenticate,
    authorize("vendor", "admin"),
    validate(busIdParamSchema),
    getRoutesForBus
);

// Create a schedule (trip)
router.post(
    "/schedules",
    authenticate,
    authorize("vendor", "admin"),
    validate(createScheduleSchema),
    createSchedule
);

export default router;