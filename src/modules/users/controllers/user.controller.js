import {
  getUserProfile,
  updateUserProfile,
  getVendorDashboardService,
  requestVendorReapproval,
} from "../services/user.service.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../../../utils/cloudinary.js";
import User from "../models/user.model.js";

export const getProfile = async (req, res, next) => {
  try {
    const user = await getUserProfile(req.user._id);
    return res.status(200).json({
      success: true,
      message: "Profile fetched successfully.",
      data: user,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const updatedUser = await updateUserProfile(
      req.user._id,
      req.body,
      req.user.role,
    );
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
};

export const getVendorDashboard = async (req, res, next) => {
  try {
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

export const requestReapproval = async (req, res, next) => {
  try {
    const result = await requestVendorReapproval(req.user._id);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided.",
      });
    }
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    if (user.profileImage) {
      const oldPublicId = user.profileImage
        .split("/")
        .slice(-2)
        .join("/")
        .split(".")[0];
      if (oldPublicId) {
        await deleteFromCloudinary(oldPublicId);
      }
    }
    const uploadResult = await uploadToCloudinary(req.file, "users/profile");
    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload image.",
        error: uploadResult.error,
      });
    }
    user.profileImage = uploadResult.url;
    await user.save();
    const updatedUser = user.toObject();
    delete updatedUser.password;
    return res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully.",
      data: updatedUser,
    });
  } catch (error) {
    return next(error);
  }
};
