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

const ok = (res, data, message = "Success", status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
  });

export const getDashboard = async (req, res, next) => {
  try {
    const data = await getAdminDashboardService();
    return ok(res, data, "Admin dashboard fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const listUsers = async (req, res, next) => {
  try {
    const result = await listUsersService(req.query);
    return ok(res, result, "Users fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await getUserByIdService(req.params.userId);
    return ok(res, user, "User fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const toggleUserActive = async (req, res, next) => {
  try {
    const result = await toggleUserActiveService(
      req.user._id,
      req.params.userId,
    );
    return ok(res, result, result.message);
  } catch (err) {
    return next(err);
  }
};

export const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!role)
      return res.status(400).json({
        success: false,
        message: "role is required in body.",
      });
    const result = await changeUserRoleService(
      req.user._id,
      req.params.userId,
      role,
    );
    return ok(res, result, "User role updated successfully.");
  } catch (err) {
    return next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const result = await deleteUserService(req.user._id, req.params.userId);
    return ok(res, null, result.message);
  } catch (err) {
    return next(err);
  }
};

export const listVendors = async (req, res, next) => {
  try {
    const result = await listVendorsService(req.query);
    return ok(res, result, "Vendors fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const approveVendor = async (req, res, next) => {
  try {
    const result = await approveVendorService(req.params.vendorId);
    return ok(res, result, result.message);
  } catch (err) {
    return next(err);
  }
};

export const rejectVendor = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await rejectVendorService(req.params.vendorId, reason);
    return ok(res, result, result.message);
  } catch (err) {
    return next(err);
  }
};

export const getVendorStats = async (req, res, next) => {
  try {
    const result = await getVendorStatsService(req.params.vendorId);
    return ok(res, result, "Vendor stats fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const listAllBuses = async (req, res, next) => {
  try {
    const result = await listAllBusesService(req.query);
    return ok(res, result, "Buses fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const toggleBusStatus = async (req, res, next) => {
  try {
    const result = await toggleBusStatusService(req.params.busId);
    return ok(res, result, result.message);
  } catch (err) {
    return next(err);
  }
};

export const listAllBookings = async (req, res, next) => {
  try {
    const result = await listAllBookingsService(req.query);
    return ok(res, result, "Bookings fetched successfully.");
  } catch (err) {
    return next(err);
  }
};

export const getBooking = async (req, res, next) => {
  try {
    const booking = await getBookingByIdAdminService(req.params.bookingId);
    return ok(res, booking, "Booking fetched successfully.");
  } catch (err) {
    return next(err);
  }
};
