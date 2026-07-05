import { getUserProfile, updateUserProfile, getVendorDashboardService } from "../services/user.service.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../../../utils/cloudinary.js";
import User from "../models/user.model.js";

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

/**
 * POST /api/users/profile/upload-image
 *
 * Uploads a profile image to Cloudinary and updates the user's profile.
 */
export const uploadProfileImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No image file provided."
            });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        // Delete old image from Cloudinary if it exists
        if (user.profileImage) {
            const oldPublicId = user.profileImage.split('/').slice(-2).join('/').split('.')[0];
            if (oldPublicId) {
                await deleteFromCloudinary(oldPublicId);
            }
        }

        // Upload new image to Cloudinary
        const uploadResult = await uploadToCloudinary(req.file, "users/profile");
        
        if (!uploadResult.success) {
            return res.status(500).json({
                success: false,
                message: "Failed to upload image.",
                error: uploadResult.error
            });
        }

        // Update user profile with new image URL
        user.profileImage = uploadResult.url;
        await user.save();

        const updatedUser = user.toObject();
        delete updatedUser.password;

        return res.status(200).json({
            success: true,
            message: "Profile image uploaded successfully.",
            data: updatedUser
        });
    } catch (error) {
        return next(error);
    }
};
