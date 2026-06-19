import { getUserProfile, updateUserProfile } from "../services/user.service.js";

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
        const updatedUser = await updateUserProfile(req.user._id, req.body);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: updatedUser
        });
    } catch (error) {
        return next(error);
    }
};
