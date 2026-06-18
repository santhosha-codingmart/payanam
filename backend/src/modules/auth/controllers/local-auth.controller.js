import {
  registerByEmail,
  loginByEmail,
  requestPasswordReset,
  verifyAndResetPassword
} from "../services/local-auth.service.js";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "../services/jwt.service.js";
import RefreshToken from "../models/refresh-token.model.js";
import User from "../../users/models/user.model.js";

const cookieOptions = (ms) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  maxAge: ms
});


export const register = async (req, res, next) => {

  try {

    const user = await registerByEmail(req.body);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken
    });

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));

    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: { id: user._id, email: user.email },
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
      token: refreshToken
    });

    res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
    res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: { id: user._id, email: user.email }
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

    // Verify refresh token JWT
    const isValid = await verifyRefreshToken(token);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired or invalid",
      });
    }

    // Check if refresh token exists in DB
    const refreshDoc = await RefreshToken.findOne({ token });

    if (!refreshDoc) {
      return res.status(401).json({
        success: false,
        message: "Refresh token not found",
      });
    }

    // Get user
    const user = await User.findById(refreshDoc.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(user);

    // Send access token as cookie
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

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

    await requestPasswordReset(email);

    // Security Best Practice: Return 200 OK whether the user exists or not
    return res.status(200).json({
      success: true,
      message: "If an account exists, an OTP has been sent to your email."
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