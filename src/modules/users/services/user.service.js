import User from "../models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";

/**
 * Get the full profile for a given user ID.
 * Password is excluded from the returned document.
 *
 * @param {string} userId - The MongoDB ObjectId of the user
 * @returns {object} The user document (without password)
 */
export const getUserProfile = async (userId) => {
    const user = await User.findById(userId).select("-password");

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    return user;
};

/**
 * Update the profile fields for a given user.
 *
 * Only allows updating safe fields: name, age, email, phoneNo.
 * Role, password, and verification flags cannot be changed through this endpoint.
 *
 * If the user tries to change their email to one that already belongs to
 * another account, a 409 Conflict error is thrown.
 * Same logic applies for phoneNo.
 *
 * @param {string} userId - The MongoDB ObjectId of the user
 * @param {object} updateData - The fields to update { name?, age?, email?, phoneNo? }
 * @returns {object} The updated user document (without password)
 */
export const updateUserProfile = async (userId, updateData) => {
    const { name, age, email, phoneNo } = updateData;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    // ── Check for email uniqueness (if they're changing it) ──────────────
    if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            throw new ApiError(409, "This email is already registered to another account.");
        }
        user.email = email;
    }

    // ── Check for phone uniqueness (if they're changing it) ──────────────
    if (phoneNo && phoneNo !== user.phoneNo) {
        const phoneExists = await User.findOne({ phoneNo });
        if (phoneExists) {
            throw new ApiError(409, "This phone number is already registered to another account.");
        }
        user.phoneNo = phoneNo;
    }

    // ── Update simple fields (only if provided) ─────────────────────────
    if (name !== undefined) user.name = name;
    if (age !== undefined) user.age = age;

    await user.save();

    // Return the user without the password field
    const updatedUser = user.toObject();
    delete updatedUser.password;

    return updatedUser;
};
