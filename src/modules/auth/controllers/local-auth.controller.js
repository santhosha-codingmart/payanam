import {
  registerByEmail,
  registerVendorByEmail,
  registerAdminByEmail,
  loginByEmail,
  requestPasswordReset,
  verifyAndResetPassword,
  sendMobileOTP,
  verifyMobileOTP,
} from "../services/local-auth.service.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../services/jwt.service.js";
import RefreshToken from "../models/refresh-token.model.js";
import User from "../../users/models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";

const cookieOptions = (ms) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: ms,
});

export const register = async (req, res, next) => {
  try {
    const user = await registerByEmail(req.body);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const registerVendor = async (req, res, next) => {
  try {
    const vendor = await registerVendorByEmail(req.body);
    const accessToken = generateAccessToken(vendor);
    const refreshToken = generateRefreshToken(vendor);
    await RefreshToken.create({
      userId: vendor._id,
      token: refreshToken,
    });
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );
    return res.status(201).json({
      success: true,
      message: "Vendor registered successfully. Welcome to Payanam!",
      user: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        role: vendor.role,
        companyName: vendor.companyName,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const registerAdmin = async (req, res, next) => {
  try {
    const admin = await registerAdminByEmail(req.body);
    const accessToken = generateAccessToken(admin);
    const refreshToken = generateRefreshToken(admin);
    await RefreshToken.create({
      userId: admin._id,
      token: refreshToken,
    });
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );
    return res.status(201).json({
      success: true,
      message: "Admin registered successfully. Welcome to Payanam!",
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const user = await loginByEmail(req.body);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name || null,
        email: user.email,
        role: user.role,
        companyName: user.companyName || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No refresh token provided",
      });
    }
    const isValid = await verifyRefreshToken(token);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired or invalid",
      });
    }
    const refreshDoc = await RefreshToken.findOne({
      token,
    });
    if (!refreshDoc) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }
    const user = await User.findById(refreshDoc.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    const accessToken = generateAccessToken(user);
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    return res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }
    await requestPasswordReset(email);
    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your email.",
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPasswordController = async (req, res, next) => {
  try {
    const { email, otpCode, newPassword } = req.body;
    await verifyAndResetPassword(email, otpCode, newPassword);
    return res.status(200).json({
      success: true,
      message: "Password reset correctly! You can now log in.",
    });
  } catch (error) {
    return next(error);
  }
};

export const sendMobileOTPController = async (req, res, next) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }
    res.status(200).json({
      success: true,
      message: "OTP sent to your mobile number. It is valid for 5 minutes.",
    });
    sendMobileOTP(mobile).catch((error) => {
      console.error("Background Mobile OTP error:", error.message);
    });
  } catch (error) {
    return next(error);
  }
};

export const verifyMobileOTPController = async (req, res, next) => {
  try {
    const { mobile, otpCode } = req.body;
    const user = await verifyMobileOTP(mobile, otpCode);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
    });
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      cookieOptions(7 * 24 * 60 * 60 * 1000),
    );
    return res.status(200).json({
      success: true,
      message: "Mobile verification successful.",
      user: {
        id: user._id,
        name: user.name || null,
        email: user.email || null,
        mobile: user.phoneNo,
        role: user.role,
        companyName: user.companyName || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      await RefreshToken.findOneAndDelete({
        token: refreshToken,
      });
    }
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    return next(error);
  }
};
