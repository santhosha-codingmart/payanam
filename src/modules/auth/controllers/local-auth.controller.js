import {
  registerByEmail,
  registerVendorByEmail,
  loginByEmail,
  requestPasswordReset,
  verifyAndResetPassword,
  sendMobileOTP,
  verifyMobileOTP
} from "../services/local-auth.service.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../services/jwt.service.js";
import RefreshToken from "../models/refresh-token.model.js";
import User from "../../users/models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";

const cookieOptions = (ms) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Browsers require SameSite=None cookies to be Secure. Use 'lax' during
  // local development so cookies are accepted over http://localhost.
  sameSite: process.env.NODE_ENV === "production" ? "none" : "none",
  maxAge: ms,
});

export const register = async (req, res, next) => {
  try {
    const user = await registerByEmail(req.body);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await RefreshToken.create({ userId: user._id, token: refreshToken });

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        name: user.name
      },
    });
  } catch (error) {
    return next(error);
  }
};

// =============================================================================
// POST /api/auth/register-vendor
// Creates a vendor account. Role is set server-side — never accepted from client.
// =============================================================================
export const registerVendor = async (req, res, next) => {
  try {
    const vendor = await registerVendorByEmail(req.body);
    const accessToken  = generateAccessToken(vendor);
    const refreshToken = generateRefreshToken(vendor);

    await RefreshToken.create({ userId: vendor._id, token: refreshToken });

    res.cookie("accessToken",  accessToken,  cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(201).json({
      success: true,
      message: "Vendor registered successfully. Welcome to Payanam!",
      user: {
        id:          vendor._id,
        name:        vendor.name,
        email:       vendor.email,
        role:        vendor.role,         // "vendor" — useful for frontend redirect
        companyName: vendor.companyName,
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

    await RefreshToken.create({ userId: user._id, token: refreshToken });

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: { 
        id: user._id, 
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    return next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: "No refresh token provided" });
    }

    const isValid = await verifyRefreshToken(token);
    if (!isValid) {
      return res.status(401).json({ success: false, message: "Refresh token expired or invalid" });
    }

    const refreshDoc = await RefreshToken.findOne({ token });
    if (!refreshDoc) {
      return res.status(401).json({ success: false, message: "Refresh token not found" });
    }

    const user = await User.findById(refreshDoc.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }

    const accessToken = generateAccessToken(user);

    // Use the same cookieOptions helper so SameSite/secure behavior is consistent
    // between environments.
    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));

    return res.status(200).json({ success: true, message: "Access token refreshed successfully" });
  } catch (error) {
    return next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // This will throw a 404 ApiError if the user does not exist, 
    // sending a "User with this email does not exist" response to the frontend.
    await requestPasswordReset(email);

    return res.status(200).json({
      success: true,
      message: "OTP has been sent to your email."
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
      message: "Password reset correctly! You can now log in."
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE OTP AUTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/mobile/send-otp
 * Step 1: receive mobile number, send OTP via SMS.
 */
export const sendMobileOTPController = async (req, res, next) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ success: false, message: "Mobile number is required" });
    }

    // Respond immediately so frontend can redirect to OTP page without waiting
    res.status(200).json({
      success: true,
      message: "OTP sent to your mobile number. It is valid for 5 minutes."
    });

    // Run the OTP generation and SMS sending in the background
    sendMobileOTP(mobile).catch(error => {
      console.error("Background Mobile OTP error:", error.message);
    });

  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/auth/mobile/verify-otp
 * Step 2: receive mobile + OTP, verify it, then auto login-or-register.
 * Returns tokens in cookies exactly like email login does.
 */
export const verifyMobileOTPController = async (req, res, next) => {
  try {
    const { mobile, otpCode } = req.body;

    // Service handles both login AND register internally
    const user = await verifyMobileOTP(mobile, otpCode);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await RefreshToken.create({ userId: user._id, token: refreshToken });

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
      success: true,
      message: "Mobile verification successful.",
      user: { id: user._id, mobile: user.phoneNo }
    });
  } catch (error) {
    return next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Clears both auth cookies and deletes the refresh token from the database.
 * This ensures the session is invalidated on both client AND server side.
 */
export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    // Delete the refresh token from MongoDB (if it exists)
    if (refreshToken) {
      await RefreshToken.findOneAndDelete({ token: refreshToken });
    }

    // Clear both cookies by setting them to empty with immediate expiry
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully."
    });
  } catch (error) {
    return next(error);
  }
};