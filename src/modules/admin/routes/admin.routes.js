import express from "express";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import {
    getDashboard,
    listUsers, getUser, toggleUserActive, changeUserRole, deleteUser,
    listVendors, approveVendor, rejectVendor, getVendorStats,
    listAllBuses, toggleBusStatus,
    listAllBookings, getBooking,
} from "../controllers/admin.controller.js";

const router = express.Router();

// All admin routes require authentication + "admin" role
router.use(authenticate, authorize("admin"));

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: >
 *       Platform administration endpoints. All routes require `role: admin`.
 *       Log in with admin credentials to get the `accessToken` cookie first.
 */

// =============================================================================
// DASHBOARD
// =============================================================================

/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     summary: Platform-wide dashboard stats
 *     description: >
 *       Returns aggregated metrics across the whole platform:
 *       user counts, vendor counts (including pending approvals),
 *       bus counts, active routes, booking stats, and total + monthly revenue.
 *       All queries run in parallel so this is a single fast call.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminDashboardResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin role required.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/dashboard", getDashboard);

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List all users (paginated)
 *     description: >
 *       Returns all users with optional filters. Use `role=vendor` to list
 *       vendors only, `isActive=false` to see banned accounts, or `search`
 *       to find by name or email. Sorted newest first.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, vendor, admin]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by account status (true = active, false = banned)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email (case-insensitive)
 *         example: santhosh
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated user list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin role required.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/users", listUsers);

/**
 * @swagger
 * /api/v1/admin/users/{userId}:
 *   get:
 *     summary: Get a single user by MongoDB ID
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *         description: MongoDB ObjectId of the user
 *     responses:
 *       200:
 *         description: User details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/AdminUserObject'
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Permanently delete a user and all their data
 *     description: >
 *       Hard-deletes the user account. If the user is a vendor, all their
 *       buses, routes, and schedules are also deleted. Bookings already
 *       made on their buses are NOT deleted (audit trail). Cannot delete
 *       another admin account.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     responses:
 *       200:
 *         description: User deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Cannot delete your own account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Cannot delete another admin account.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/users/:userId", getUser);
router.delete("/users/:userId", deleteUser);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/toggle-active:
 *   patch:
 *     summary: Ban or unban a user account
 *     description: >
 *       Toggles `isActive` on the user document. A banned user (`isActive: false`)
 *       will be blocked by the auth middleware on every subsequent request with a
 *       `403 Your account has been suspended` response. Cannot ban yourself or
 *       another admin.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     responses:
 *       200:
 *         description: Account status toggled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminToggleActiveResponse'
 *       400:
 *         description: Cannot ban yourself or another admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/users/:userId/toggle-active", toggleUserActive);

/**
 * @swagger
 * /api/v1/admin/users/{userId}/role:
 *   patch:
 *     summary: Change a user's role
 *     description: >
 *       Promotes a user to vendor or demotes a vendor back to user.
 *       When promoting to vendor the `vendorApprovalStatus` is reset to
 *       `PENDING` so the admin must explicitly approve them before they
 *       can list buses or flights. Cannot change another admin's role.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminChangeRoleRequest'
 *     responses:
 *       200:
 *         description: Role updated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User role updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/AdminUserObject'
 *       400:
 *         description: Invalid role value or self-modification attempt.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/users/:userId/role", changeUserRole);

// =============================================================================
// VENDOR MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/v1/admin/vendors:
 *   get:
 *     summary: List all vendors (paginated)
 *     description: >
 *       Returns users with `role: vendor`. Filter by `status=PENDING` to see
 *       all vendors awaiting approval. Search by name, email, or company name.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by approval status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, email, or company name
 *         example: KPN
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated vendor list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/vendors", listVendors);

/**
 * @swagger
 * /api/v1/admin/vendors/{vendorId}/stats:
 *   get:
 *     summary: Get detailed stats for a specific vendor
 *     description: >
 *       Returns the vendor profile alongside aggregated stats:
 *       total and active bus count, confirmed booking count, and total revenue
 *       earned from their buses.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     responses:
 *       200:
 *         description: Vendor stats.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVendorStatsResponse'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/vendors/:vendorId/stats", getVendorStats);

/**
 * @swagger
 * /api/v1/admin/vendors/{vendorId}/approve:
 *   patch:
 *     summary: Approve a vendor application
 *     description: >
 *       Sets `vendorApprovalStatus` to `APPROVED`. After approval the vendor
 *       can create buses, routes, and schedules. Only works on users with
 *       `role: vendor`.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     responses:
 *       200:
 *         description: Vendor approved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVendorApproveResponse'
 *       400:
 *         description: User is not a vendor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/vendors/:vendorId/approve", approveVendor);

/**
 * @swagger
 * /api/v1/admin/vendors/{vendorId}/reject:
 *   patch:
 *     summary: Reject a vendor application
 *     description: >
 *       Sets `vendorApprovalStatus` to `REJECTED`. Optionally accepts a
 *       `reason` string in the body which is returned in the response
 *       (useful for logging or notifying the vendor).
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorId
 *         required: true
 *         schema:
 *           type: string
 *         example: 665f1a2b3c4d5e6f7a8b9c0d
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminVendorRejectRequest'
 *     responses:
 *       200:
 *         description: Vendor rejected.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminVendorApproveResponse'
 *       400:
 *         description: User is not a vendor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Vendor not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/vendors/:vendorId/reject", rejectVendor);

// =============================================================================
// BUS MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/v1/admin/buses:
 *   get:
 *     summary: List all buses across all vendors (paginated)
 *     description: >
 *       Returns every bus on the platform with its operator details populated.
 *       Filter by `status`, `vendorId`, or search by bus name, number, or
 *       operator name. Sorted newest first.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, MAINTENANCE, RETIRED]
 *         description: Filter by bus status
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of a vendor to see only their buses
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by bus name, number, or operator name
 *         example: KPN
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated bus list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminBusListResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/buses", listAllBuses);

/**
 * @swagger
 * /api/v1/admin/buses/{busId}/toggle-status:
 *   patch:
 *     summary: Toggle a bus between ACTIVE and INACTIVE
 *     description: >
 *       Flips the bus `status` field between `ACTIVE` and `INACTIVE`.
 *       An `INACTIVE` bus will not appear in search results and cannot
 *       accept new bookings.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: busId
 *         required: true
 *         schema:
 *           type: string
 *         example: 682abc1234567890abcd1234
 *     responses:
 *       200:
 *         description: Bus status toggled.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminToggleBusResponse'
 *       404:
 *         description: Bus not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/buses/:busId/toggle-status", toggleBusStatus);

// =============================================================================
// BOOKING MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /api/v1/admin/bookings:
 *   get:
 *     summary: List all bookings across the platform (paginated)
 *     description: >
 *       Returns every booking with user, bus, route, and schedule details
 *       populated. Filter by `status`, `vendorId` (bookings on their buses),
 *       or `search` by booking ID (e.g. `PAY-A3F2B1`). Sorted newest first.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, CANCELLED]
 *         description: Filter by booking status
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter to bookings on a specific vendor's buses
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by booking ID (e.g. PAY-A3F2B1)
 *         example: PAY-A3F2B1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated booking list.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminBookingListResponse'
 *       401:
 *         description: Not authenticated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/bookings", listAllBookings);

/**
 * @swagger
 * /api/v1/admin/bookings/{bookingId}:
 *   get:
 *     summary: Get full details of a specific booking
 *     description: >
 *       Returns the complete booking document with all populated refs
 *       (user, bus, route with stops, schedule). Uses the human-readable
 *       `bookingId` (e.g. `PAY-A3F2B1`), **not** the MongoDB `_id`.
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         example: PAY-A3F2B1
 *         description: Human-readable booking reference (format PAY-XXXXXX)
 *     responses:
 *       200:
 *         description: Full booking detail.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BookingDetailResponse'
 *       404:
 *         description: Booking not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/bookings/:bookingId", getBooking);

export default router;
