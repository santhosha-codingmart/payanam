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
  getScheduleById,
  searchBuses,
  blockSeats,
  addReview,
  cancelSchedule,
  getVendorSchedules,
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
  blockSeatsSchema,
  createReviewSchema,
} from "../validators/bus.validator.js";

const router = express.Router();
router.get("/search", validate(searchBusSchema), searchBuses);
router.get(
  "/schedules/:scheduleId/seats",
  validate(scheduleIdParamSchema),
  getScheduleSeats,
);
router.get(
  "/schedules/:scheduleId",
  validate(scheduleIdParamSchema),
  getScheduleById,
);
router.post(
  "/",
  authenticate,
  authorize("vendor", "admin"),
  validate(createBusSchema),
  createBus,
);
router.get("/", authenticate, authorize("vendor", "admin"), getVendorBuses);
router.post(
  "/routes",
  authenticate,
  authorize("vendor", "admin"),
  validate(createRouteSchema),
  createRoute,
);
router.get(
  "/:id/routes",
  authenticate,
  authorize("vendor", "admin"),
  validate(busIdParamSchema),
  getRoutesForBus,
);
router.post(
  "/schedules",
  authenticate,
  authorize("vendor", "admin"),
  validate(createScheduleSchema),
  createSchedule,
);
router.get(
  "/schedules",
  authenticate,
  authorize("vendor", "admin"),
  getVendorSchedules,
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
  cancelSchedule,
);
router.get("/:id", authenticate, validate(busIdParamSchema), getBusById);
router.patch(
  "/:id",
  authenticate,
  authorize("vendor", "admin"),
  validate(updateBusSchema),
  updateBus,
);
router.delete(
  "/:id",
  authenticate,
  authorize("vendor", "admin"),
  validate(busIdParamSchema),
  deleteBus,
);
router.post(
  "/:busId/reviews",
  authenticate,
  validate(createReviewSchema),
  addReview,
);

export default router;
