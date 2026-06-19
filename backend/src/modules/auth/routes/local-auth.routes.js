import express from "express";

import {
    login,
    refresh,
    register,
    forgotPassword,
    resetPasswordController,
    sendMobileOTPController,
    verifyMobileOTPController,
    logout
} from "../controllers/local-auth.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    sendMobileOTPSchema,
    verifyMobileOTPSchema
} from "../validators/auth.validator.js";

let router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Swagger JSDoc annotations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Auth - Email
 *     description: Registration, login, and password reset via email
 *   - name: Auth - Mobile OTP
 *     description: Passwordless login & registration via mobile OTP (SMS)
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user with email + password
 *     tags: [Auth - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created. accessToken and refreshToken cookies are set.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful. Cookies are set.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Invalid credentials or wrong password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh the access token using refreshToken cookie
 *     tags: [Auth - Email]
 *     description: >
 *       Call this when the accessToken expires (you get a 401).
 *       The browser automatically sends the refreshToken HttpOnly cookie.
 *     responses:
 *       200:
 *         description: New accessToken cookie issued.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: No/invalid refresh token or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth - Email]
 *     security:
 *       - cookieAuth: []
 *     description: >
 *       Clears the accessToken and refreshToken cookies, and deletes
 *       the refresh token from the database so it cannot be reused.
 *     responses:
 *       200:
 *         description: Logged out successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password-reset OTP via email
 *     tags: [Auth - Email]
 *     description: >
 *       Generates a 6-digit OTP valid for **5 minutes** and emails it.
 *       Always returns 200 OK to prevent account enumeration.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP sent (or silently skipped if email doesn't exist).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password using OTP received via email
 *     tags: [Auth - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: OTP expired or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Incorrect OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPasswordController);

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE OTP ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/auth/mobile/send-otp:
 *   post:
 *     summary: "Step 1 — Send OTP to a mobile number"
 *     tags: [Auth - Mobile OTP]
 *     description: >
 *       Accepts a mobile number and fires a 6-digit OTP via SMS.
 *       Works for **both new and existing users** — no need to know if the
 *       user has an account yet. OTP is valid for **5 minutes**.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMobileOTPRequest'
 *           example:
 *             mobile: "+919876543210"
 *     responses:
 *       200:
 *         description: OTP sent successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "OTP sent to your mobile number. It is valid for 5 minutes."
 *       400:
 *         description: Invalid mobile number format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: SMS service not configured or Twilio error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/mobile/send-otp', validate(sendMobileOTPSchema), sendMobileOTPController);

/**
 * @swagger
 * /api/auth/mobile/verify-otp:
 *   post:
 *     summary: "Step 2 — Verify OTP → auto login or register"
 *     tags: [Auth - Mobile OTP]
 *     description: >
 *       Verifies the OTP sent to the mobile number.
 *
 *       - If a user with this mobile **already exists** → **logs them in**
 *
 *       - If no user with this mobile exists → **creates a new account** and logs them in
 *
 *       In both cases, `accessToken` and `refreshToken` cookies are set exactly
 *       like the email login flow. The frontend does **not** need separate
 *       register / login pages for mobile auth.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyMobileOTPRequest'
 *           example:
 *             mobile: "+919876543210"
 *             otpCode: "482910"
 *     responses:
 *       200:
 *         description: Verified. Cookies set. Returns user info.
 *         headers:
 *           Set-Cookie:
 *             description: "accessToken=<jwt>; HttpOnly  |  refreshToken=<jwt>; HttpOnly"
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MobileAuthUserResponse'
 *             example:
 *               success: true
 *               message: "Mobile verification successful."
 *               user:
 *                 id: "665f1a2b3c4d5e6f7a8b9c0d"
 *                 mobile: "+919876543210"
 *       400:
 *         description: OTP expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "OTP has expired. Please request a new one."
 *       401:
 *         description: Incorrect OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Incorrect OTP. Please check and try again."
 */
router.post('/mobile/verify-otp', validate(verifyMobileOTPSchema), verifyMobileOTPController);

export default router;