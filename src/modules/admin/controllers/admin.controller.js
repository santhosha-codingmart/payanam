import {
    getAdminDashboardService,
    listUsersService,
    getUserByIdService,
    toggleUserActiveService,
    changeUserRoleService,
    deleteUserService,
    listVendorsService,
    approveVendorService,
    rejectVendorService,
    getVendorStatsService,
    listAllBusesService,
    toggleBusStatusService,
    listAllBookingsService,
    getBookingByIdAdminService,
} from "../services/admin.service.js";

// ── Helpers ────────────────────────────────────────────────────────────────────
const ok = (res, data, message = "Success", status = 200) =>
    res.status(status).json({ success: true, message, data });

// =============================================================================
// DASHBOARD
// =============================================================================

/** GET /api/v1/admin/dashboard */
export const getDashboard = async (req, res, next) => {
    try {
        const data = await getAdminDashboardService();
        return ok(res, data, "Admin dashboard fetched successfully.");
    } catch (err) { return next(err); }
};

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/** GET /api/v1/admin/users */
export const listUsers = async (req, res, next) => {
    try {
        const result = await listUsersService(req.query);
        return ok(res, result, "Users fetched successfully.");
    } catch (err) { return next(err); }
};

/** GET /api/v1/admin/users/:userId */
export const getUser = async (req, res, next) => {
    try {
        const user = await getUserByIdService(req.params.userId);
        return ok(res, user, "User fetched successfully.");
    } catch (err) { return next(err); }
};

/** PATCH /api/v1/admin/users/:userId/toggle-active */
export const toggleUserActive = async (req, res, next) => {
    try {
        const result = await toggleUserActiveService(req.user._id, req.params.userId);
        return ok(res, result, result.message);
    } catch (err) { return next(err); }
};

/** PATCH /api/v1/admin/users/:userId/role */
export const changeUserRole = async (req, res, next) => {
    try {
        const { role } = req.body;
        if (!role) return res.status(400).json({ success: false, message: "role is required in body." });
        const result = await changeUserRoleService(req.user._id, req.params.userId, role);
        return ok(res, result, "User role updated successfully.");
    } catch (err) { return next(err); }
};

/** DELETE /api/v1/admin/users/:userId */
export const deleteUser = async (req, res, next) => {
    try {
        const result = await deleteUserService(req.user._id, req.params.userId);
        return ok(res, null, result.message);
    } catch (err) { return next(err); }
};

// =============================================================================
// VENDOR MANAGEMENT
// =============================================================================

/** GET /api/v1/admin/vendors */
export const listVendors = async (req, res, next) => {
    try {
        const result = await listVendorsService(req.query);
        return ok(res, result, "Vendors fetched successfully.");
    } catch (err) { return next(err); }
};

/** PATCH /api/v1/admin/vendors/:vendorId/approve */
export const approveVendor = async (req, res, next) => {
    try {
        const result = await approveVendorService(req.params.vendorId);
        return ok(res, result, result.message);
    } catch (err) { return next(err); }
};

/** PATCH /api/v1/admin/vendors/:vendorId/reject */
export const rejectVendor = async (req, res, next) => {
    try {
        const { reason } = req.body;
        const result = await rejectVendorService(req.params.vendorId, reason);
        return ok(res, result, result.message);
    } catch (err) { return next(err); }
};

/** GET /api/v1/admin/vendors/:vendorId/stats */
export const getVendorStats = async (req, res, next) => {
    try {
        const result = await getVendorStatsService(req.params.vendorId);
        return ok(res, result, "Vendor stats fetched successfully.");
    } catch (err) { return next(err); }
};

// =============================================================================
// BUS MANAGEMENT
// =============================================================================

/** GET /api/v1/admin/buses */
export const listAllBuses = async (req, res, next) => {
    try {
        const result = await listAllBusesService(req.query);
        return ok(res, result, "Buses fetched successfully.");
    } catch (err) { return next(err); }
};

/** PATCH /api/v1/admin/buses/:busId/toggle-status */
export const toggleBusStatus = async (req, res, next) => {
    try {
        const result = await toggleBusStatusService(req.params.busId);
        return ok(res, result, result.message);
    } catch (err) { return next(err); }
};

// =============================================================================
// BOOKING MANAGEMENT
// =============================================================================

/** GET /api/v1/admin/bookings */
export const listAllBookings = async (req, res, next) => {
    try {
        const result = await listAllBookingsService(req.query);
        return ok(res, result, "Bookings fetched successfully.");
    } catch (err) { return next(err); }
};

/** GET /api/v1/admin/bookings/:bookingId */
export const getBooking = async (req, res, next) => {
    try {
        const booking = await getBookingByIdAdminService(req.params.bookingId);
        return ok(res, booking, "Booking fetched successfully.");
    } catch (err) { return next(err); }
};
