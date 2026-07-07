// =============================================================================
// Admin Service — All business logic for admin operations
//
// CAPABILITIES:
//   - Dashboard stats (users, vendors, bookings, revenue)
//   - User management  (list, get, ban/unban, change role)
//   - Vendor management (list pending, approve, reject)
//   - Bus management (list all, toggle status)
//   - Booking management (list all, cancel any booking)
//   - Platform overview (revenue, active routes, etc.)
// =============================================================================

import mongoose from "mongoose";
import User from "../../users/models/user.model.js";
import { Bus } from "../../bus/models/bus.model.js";
import { Route } from "../../bus/models/route.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import Booking from "../../bookings/models/booking.model.js";
import { ApiError } from "../../../utils/ApiError.js";

// =============================================================================
// DASHBOARD OVERVIEW
// =============================================================================
export const getAdminDashboardService = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalUsers,
        totalVendors,
        pendingVendors,
        totalBuses,
        activeBuses,
        totalRoutes,
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        monthlyBookings,
        revenueAgg,
        monthlyRevenueAgg,
    ] = await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "vendor" }),
        User.countDocuments({ role: "vendor", vendorApprovalStatus: "PENDING" }),
        Bus.countDocuments(),
        Bus.countDocuments({ status: "ACTIVE" }),
        Route.countDocuments({ status: "ACTIVE" }),
        Booking.countDocuments(),
        Booking.countDocuments({ bookingStatus: "CONFIRMED" }),
        Booking.countDocuments({ bookingStatus: "CANCELLED" }),
        Booking.countDocuments({
            bookingStatus: "CONFIRMED",
            bookedAt: { $gte: startOfMonth },
        }),
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED" } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED", bookedAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;
    const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

    return {
        users: {
            total: totalUsers,
            totalVendors,
            pendingVendorApprovals: pendingVendors,
        },
        buses: {
            total: totalBuses,
            active: activeBuses,
            inactive: totalBuses - activeBuses,
        },
        routes: {
            active: totalRoutes,
        },
        bookings: {
            total: totalBookings,
            confirmed: confirmedBookings,
            cancelled: cancelledBookings,
            thisMonth: monthlyBookings,
        },
        revenue: {
            total: totalRevenue,
            thisMonth: monthlyRevenue,
        },
    };
};

// =============================================================================
// USER MANAGEMENT
// =============================================================================

/**
 * List all users with optional filters: role, isActive, search (name/email)
 * Paginated.
 */
export const listUsersService = async (filters = {}) => {
    const { role, isActive, search, page = 1, limit = 20 } = filters;

    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true" || isActive === true;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [users, totalCount] = await Promise.all([
        User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        User.countDocuments(query),
    ]);

    return {
        users,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
};

/** Get a single user by MongoDB _id */
export const getUserByIdService = async (userId) => {
    const user = await User.findById(userId).select("-password");
    if (!user) throw new ApiError(404, "User not found.");
    return user;
};

/**
 * Ban or unban a user account.
 * An admin cannot ban themselves.
 */
export const toggleUserActiveService = async (adminId, targetUserId) => {
    if (adminId.toString() === targetUserId.toString()) {
        throw new ApiError(400, "You cannot ban your own admin account.");
    }

    const user = await User.findById(targetUserId);
    if (!user) throw new ApiError(404, "User not found.");
    if (user.role === "admin") throw new ApiError(403, "Cannot ban another admin account.");

    user.isActive = !user.isActive;
    await user.save();

    return {
        userId: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive,
        message: user.isActive ? "User account has been reactivated." : "User account has been banned.",
    };
};

/**
 * Change a user's role (e.g., promote user → vendor, or demote vendor → user).
 * Cannot change an admin's role.
 */
export const changeUserRoleService = async (adminId, targetUserId, newRole) => {
    const validRoles = ["user", "vendor"];
    if (!validRoles.includes(newRole)) {
        throw new ApiError(400, `Invalid role. Allowed: ${validRoles.join(", ")}.`);
    }

    if (adminId.toString() === targetUserId.toString()) {
        throw new ApiError(400, "You cannot change your own role.");
    }

    const user = await User.findById(targetUserId);
    if (!user) throw new ApiError(404, "User not found.");
    if (user.role === "admin") throw new ApiError(403, "Cannot change role of another admin.");

    user.role = newRole;
    // If being made a vendor, set approval status to PENDING for review
    if (newRole === "vendor") user.vendorApprovalStatus = "PENDING";
    await user.save();

    return {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorApprovalStatus: user.vendorApprovalStatus,
    };
};

/** Hard delete a user account (also removes their buses, routes, schedules) */
export const deleteUserService = async (adminId, targetUserId) => {
    if (adminId.toString() === targetUserId.toString()) {
        throw new ApiError(400, "You cannot delete your own admin account.");
    }

    const user = await User.findById(targetUserId);
    if (!user) throw new ApiError(404, "User not found.");
    if (user.role === "admin") throw new ApiError(403, "Cannot delete another admin account.");

    // If vendor, clean up their buses and routes
    if (user.role === "vendor") {
        const buses = await Bus.find({ operatorId: targetUserId }).select("_id");
        const busIds = buses.map((b) => b._id);
        await Route.deleteMany({ busId: { $in: busIds } });
        await Schedule.deleteMany({ busId: { $in: busIds } });
        await Bus.deleteMany({ operatorId: targetUserId });
    }

    await User.findByIdAndDelete(targetUserId);

    return { message: `User ${user.name || user.email} and all associated data have been deleted.` };
};

// =============================================================================
// VENDOR MANAGEMENT
// =============================================================================

/** List vendors by approval status */
export const listVendorsService = async (filters = {}) => {
    const { status, search, page = 1, limit = 20 } = filters;

    const query = { role: "vendor" };
    if (status) query.vendorApprovalStatus = status.toUpperCase();
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { companyName: { $regex: search, $options: "i" } },
        ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [vendors, totalCount] = await Promise.all([
        User.find(query)
            .select("-password")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        User.countDocuments(query),
    ]);

    return {
        vendors,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
};

/** Approve a vendor account */
export const approveVendorService = async (vendorId) => {
    const vendor = await User.findById(vendorId);
    if (!vendor) throw new ApiError(404, "Vendor not found.");
    if (vendor.role !== "vendor") throw new ApiError(400, "This user is not a vendor.");

    vendor.vendorApprovalStatus = "APPROVED";
    await vendor.save();

    return {
        vendorId: vendor._id,
        name: vendor.name,
        email: vendor.email,
        companyName: vendor.companyName,
        vendorApprovalStatus: vendor.vendorApprovalStatus,
        message: "Vendor approved successfully. They can now list buses and flights.",
    };
};

/** Reject a vendor account (with optional reason) */
export const rejectVendorService = async (vendorId, reason) => {
    const vendor = await User.findById(vendorId);
    if (!vendor) throw new ApiError(404, "Vendor not found.");
    if (vendor.role !== "vendor") throw new ApiError(400, "This user is not a vendor.");

    vendor.vendorApprovalStatus = "REJECTED";
    await vendor.save();

    return {
        vendorId: vendor._id,
        name: vendor.name,
        email: vendor.email,
        vendorApprovalStatus: vendor.vendorApprovalStatus,
        reason: reason || "No reason provided.",
        message: "Vendor application rejected.",
    };
};

/**
 * Get detailed stats for a specific vendor:
 * total buses, active routes, bookings on their buses, revenue earned.
 */
export const getVendorStatsService = async (vendorId) => {
    const vendor = await User.findById(vendorId).select("-password");
    if (!vendor) throw new ApiError(404, "Vendor not found.");
    if (vendor.role !== "vendor") throw new ApiError(400, "This user is not a vendor.");

    const [totalBuses, activeBuses, totalBookings, confirmedBookings, revenueAgg] =
        await Promise.all([
            Bus.countDocuments({ operatorId: vendorId }),
            Bus.countDocuments({ operatorId: vendorId, status: "ACTIVE" }),
            Booking.countDocuments({ operatorId: vendorId }),
            Booking.countDocuments({ operatorId: vendorId, bookingStatus: "CONFIRMED" }),
            Booking.aggregate([
                { $match: { operatorId: new mongoose.Types.ObjectId(vendorId), bookingStatus: "CONFIRMED" } },
                { $group: { _id: null, total: { $sum: "$totalFare" } } },
            ]),
        ]);

    return {
        vendor: {
            id: vendor._id,
            name: vendor.name,
            email: vendor.email,
            companyName: vendor.companyName,
            gstNumber: vendor.gstNumber,
            vendorApprovalStatus: vendor.vendorApprovalStatus,
            isActive: vendor.isActive,
            joinedAt: vendor.createdAt,
        },
        stats: {
            buses: { total: totalBuses, active: activeBuses },
            bookings: { total: totalBookings, confirmed: confirmedBookings },
            revenue: revenueAgg[0]?.total || 0,
        },
    };
};

// =============================================================================
// BUS MANAGEMENT
// =============================================================================

/** List all buses across all vendors with optional filters */
export const listAllBusesService = async (filters = {}) => {
    const { status, search, vendorId, page = 1, limit = 20 } = filters;

    const query = {};
    if (status) query.status = status.toUpperCase();
    if (vendorId) query.operatorId = vendorId;
    if (search) {
        query.$or = [
            { busName: { $regex: search, $options: "i" } },
            { busNumber: { $regex: search, $options: "i" } },
            { operatorName: { $regex: search, $options: "i" } },
        ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [buses, totalCount] = await Promise.all([
        Bus.find(query)
            .select("busName busNumber busType operatorId operatorName status totalSeats averageRating createdAt")
            .populate("operatorId", "name email companyName")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Bus.countDocuments(query),
    ]);

    return {
        buses,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
};

/** Toggle a bus status between ACTIVE and INACTIVE */
export const toggleBusStatusService = async (busId) => {
    const bus = await Bus.findById(busId);
    if (!bus) throw new ApiError(404, "Bus not found.");

    bus.status = bus.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await bus.save();

    return {
        busId: bus._id,
        busName: bus.busName,
        busNumber: bus.busNumber,
        status: bus.status,
        message: `Bus status changed to ${bus.status}.`,
    };
};

// =============================================================================
// BOOKING MANAGEMENT
// =============================================================================

/** List all bookings across the platform */
export const listAllBookingsService = async (filters = {}) => {
    const { status, vendorId, search, page = 1, limit = 20 } = filters;

    const query = {};
    if (status) query.bookingStatus = status.toUpperCase();
    if (vendorId) query.operatorId = vendorId;
    if (search) query.bookingId = { $regex: search, $options: "i" };

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [bookings, totalCount] = await Promise.all([
        Booking.find(query)
            .select("-cancellationPolicy -__v")
            .populate("userId",     "name email")
            .populate("busId",      "busName busNumber operatorName")
            .populate("routeId",    "source destination")
            .populate("scheduleId", "departureDate departureTime")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        Booking.countDocuments(query),
    ]);

    return {
        bookings,
        pagination: {
            totalCount,
            totalPages: Math.ceil(totalCount / limitNum),
            currentPage: pageNum,
            limit: limitNum,
        },
    };
};

/** Get a single booking by its PAY-XXXXXX bookingId */
export const getBookingByIdAdminService = async (bookingId) => {
    const booking = await Booking.findOne({ bookingId })
        .populate("userId",     "name email phoneNo")
        .populate("busId",      "busName busNumber busType operatorName")
        .populate("routeId",    "source destination stops distanceInKm")
        .populate("scheduleId", "departureDate departureTime arrivalTime");

    if (!booking) throw new ApiError(404, "Booking not found.");
    return booking;
};
