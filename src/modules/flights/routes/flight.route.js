import express from "express";
import {
  createFlight,
  getVendorFlights,
  getFlightById,
  updateFlight,
  deleteFlight,
  createFlightRoute,
  getRoutesForFlight,
  createFlightSchedule,
  getFlightScheduleSeats,
  searchFlights,
  blockSeats,
  cancelFlightSchedule,
  addFlightReview,
  getVendorFlightSchedules,
  getFlightScheduleById,
  createFlightBooking,
} from "../controllers/flight.controller.js";
import {
  createPriceLock,
  getUserPriceLocks,
  getPriceLockById,
  usePriceLock,
} from "../controllers/priceLock.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
  createFlightSchema,
  updateFlightSchema,
  flightIdParamSchema,
  createFlightRouteSchema,
  createFlightScheduleSchema,
  scheduleIdParamSchema,
  searchFlightSchema,
  blockSeatsSchema,
  createFlightReviewSchema,
  createPriceLockSchema,
  priceLockIdParamSchema,
  createFlightBookingSchema,
} from "../validators/flight.validator.js";

const router = express.Router();
router.get("/search", validate(searchFlightSchema), searchFlights);
router.post(
  "/price-locks",
  authenticate,
  validate(createPriceLockSchema),
  createPriceLock,
);
router.get("/price-locks/my-locks", authenticate, getUserPriceLocks);
router.get(
  "/price-locks/:priceLockId",
  authenticate,
  validate(priceLockIdParamSchema),
  getPriceLockById,
);
router.post(
  "/price-locks/:priceLockId/book",
  authenticate,
  validate(priceLockIdParamSchema),
  usePriceLock,
);
router.get(
  "/schedules/:scheduleId/seats",
  validate(scheduleIdParamSchema),
  getFlightScheduleSeats,
);
router.get(
  "/schedules/:scheduleId",
  validate(scheduleIdParamSchema),
  getFlightScheduleById,
);
router.post(
  "/",
  authenticate,
  authorize("vendor", "admin"),
  validate(createFlightSchema),
  createFlight,
);
router.get("/", authenticate, authorize("vendor", "admin"), getVendorFlights);
router.post(
  "/routes",
  authenticate,
  authorize("vendor", "admin"),
  validate(createFlightRouteSchema),
  createFlightRoute,
);
router.get(
  "/:id/routes",
  authenticate,
  authorize("vendor", "admin"),
  validate(flightIdParamSchema),
  getRoutesForFlight,
);
router.post(
  "/schedules",
  authenticate,
  authorize("vendor", "admin"),
  validate(createFlightScheduleSchema),
  createFlightSchedule,
);
router.get(
  "/schedules",
  authenticate,
  authorize("vendor", "admin"),
  getVendorFlightSchedules,
);
router.post(
  "/schedules/:scheduleId/block-seats",
  authenticate,
  validate(blockSeatsSchema),
  blockSeats,
);
router.patch(
  "/schedules/:scheduleId/cancel",
  authenticate,
  authorize("vendor", "admin"),
  validate(scheduleIdParamSchema),
  cancelFlightSchedule,
);
router.get("/:id", authenticate, validate(flightIdParamSchema), getFlightById);
router.patch(
  "/:id",
  authenticate,
  authorize("vendor", "admin"),
  validate(updateFlightSchema),
  updateFlight,
);
router.delete(
  "/:id",
  authenticate,
  authorize("vendor", "admin"),
  validate(flightIdParamSchema),
  deleteFlight,
);
router.post(
  "/:flightId/reviews",
  authenticate,
  validate(createFlightReviewSchema),
  addFlightReview,
);
router.post(
  "/bookings",
  authenticate,
  validate(createFlightBookingSchema),
  createFlightBooking,
);

export default router;
