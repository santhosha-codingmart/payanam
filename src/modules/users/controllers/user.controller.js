import { getUserProfile, updateUserProfile, getVendorDashboardService } from "../services/user.service.js";

/**
 * GET /api/users/profile
 *
 * Returns the logged-in user's profile.
 * `req.user` is set by the authenticate middleware.
 */
export const getProfile = async (req, res, next) => {
    try {
        const user = await getUserProfile(req.user._id);

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully.",
            data: user
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * PUT /api/users/profile
 *
 * Updates the logged-in user's profile.
 * Accepts: name, age, email, phoneNo (all optional).
 */
export const updateProfile = async (req, res, next) => {
    try {
        // Pass req.user.role so the service can conditionally apply
        // vendor-only fields (companyName, gstNumber) for vendors.
        const updatedUser = await updateUserProfile(req.user._id, req.body, req.user.role);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: updatedUser
        });
    } catch (error) {
        return next(error);
    }
};

/**
 * GET /api/users/vendor/dashboard
 *
 * Returns a single-call dashboard summary for the logged-in vendor:
 *   - Bus & flight counts (total / active / inactive)
 *   - Upcoming scheduled trips (bus + flight combined)
 *   - Confirmed booking count
 *   - Total revenue from confirmed bookings
 *
 * All DB queries run in parallel (Promise.all) so this is fast
 * even when the vendor has hundreds of buses, flights, and schedules.
 */
export const getVendorDashboard = async (req, res, next) => {
    try {
        // req.user._id is the vendor's MongoDB ObjectId — set by authenticate middleware
        const summary = await getVendorDashboardService(req.user._id);

        return res.status(200).json({
            success: true,
            message: "Dashboard summary fetched successfully.",
            data: summary,
        });
    } catch (error) {
        return next(error);
    }
};
