import express from "express";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import {
  getDashboard,
  listUsers,
  getUser,
  toggleUserActive,
  changeUserRole,
  deleteUser,
  listVendors,
  approveVendor,
  rejectVendor,
  getVendorStats,
  listAllBuses,
  toggleBusStatus,
  listAllBookings,
  getBooking,
} from "../controllers/admin.controller.js";

const router = express.Router();
router.use(authenticate, authorize("admin"));
router.get("/dashboard", getDashboard);
router.get("/users", listUsers);
router.get("/users/:userId", getUser);
router.delete("/users/:userId", deleteUser);
router.patch("/users/:userId/toggle-active", toggleUserActive);
router.patch("/users/:userId/role", changeUserRole);
router.get("/vendors", listVendors);
router.get("/vendors/:vendorId/stats", getVendorStats);
router.patch("/vendors/:vendorId/approve", approveVendor);
router.patch("/vendors/:vendorId/reject", rejectVendor);
router.get("/buses", listAllBuses);
router.patch("/buses/:busId/toggle-status", toggleBusStatus);
router.get("/bookings", listAllBookings);
router.get("/bookings/:bookingId", getBooking);

export default router;
