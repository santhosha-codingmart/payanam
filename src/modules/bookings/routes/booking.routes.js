import express from "express";
import {
  createBooking,
  getBookingById,
  getMyBookings,
  getVendorBookings,
  cancelBooking,
  downloadTicket,
} from "../controllers/booking.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
  createBookingSchema,
  cancelBookingSchema,
  getBookingSchema,
} from "../validations/booking.validator.js";

const router = express.Router();
router.post("/", authenticate, validate(createBookingSchema), createBooking);
router.get("/my-bookings", authenticate, getMyBookings);
router.get(
  "/vendor-bookings",
  authenticate,
  authorize("vendor"),
  getVendorBookings,
);
router.get(
  "/:bookingId",
  authenticate,
  validate(getBookingSchema),
  getBookingById,
);
router.post(
  "/:bookingId/cancel",
  authenticate,
  validate(cancelBookingSchema),
  cancelBooking,
);
router.get(
  "/:bookingId/download-ticket",
  authenticate,
  validate(getBookingSchema),
  downloadTicket,
);

export default router;
