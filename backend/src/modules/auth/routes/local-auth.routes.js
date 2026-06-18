import express from "express";

import { login, refresh, register, forgotPassword, resetPasswordController } from "../controllers/local-auth.controller.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.validator.js";

let router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Swagger JSDoc annotations
// swagger-jsdoc reads these comment blocks and merges them into openapi.json
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: User registration, login, token refresh, and password reset
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User created. An accessToken and refreshToken cookie are set automatically.
 *         headers:
 *           Set-Cookie:
 *             description: "accessToken=<jwt>; HttpOnly  |  refreshToken=<jwt>; HttpOnly"
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *             example:
 *               success: true
 *               message: "User registered successfully"
 *               user:
 *                 id: "665f1a2b3c4d5e6f7a8b9c0d"
 *                 email: "user@example.com"
 *       400:
 *         description: Validation error (weak password, missing fields…)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email is already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Email is already Registered"
 */
router.post('/register', validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful. accessToken and refreshToken cookies are set.
 *         headers:
 *           Set-Cookie:
 *             description: "accessToken=<jwt>; HttpOnly  |  refreshToken=<jwt>; HttpOnly"
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthUserResponse'
 *             example:
 *               success: true
 *               message: "Login successful"
 *               user:
 *                 id: "665f1a2b3c4d5e6f7a8b9c0d"
 *                 email: "user@example.com"
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
 *             example:
 *               success: false
 *               message: "Wrong Password"
 */
router.post('/login', validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh the access token using the refreshToken cookie
 *     tags: [Auth]
 *     description: >
 *       Send this request when your accessToken has expired (you receive a 401).
 *       The browser will automatically include the `refreshToken` HttpOnly cookie.
 *       On success a new `accessToken` cookie is issued.
 *     responses:
 *       200:
 *         description: New accessToken cookie issued.
 *         headers:
 *           Set-Cookie:
 *             description: "accessToken=<jwt>; HttpOnly"
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Access token refreshed successfully"
 *       401:
 *         description: No refresh token, token expired, or user not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request a password-reset OTP
 *     tags: [Auth]
 *     description: >
 *       Generates a 6-digit OTP valid for **5 minutes** and emails it to the user.
 *       For security, this endpoint always returns 200 OK whether the email exists
 *       or not (prevents account enumeration).
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
 *             example:
 *               success: true
 *               message: "If an account exists, an OTP has been sent to your email."
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
 *     summary: Reset password using OTP
 *     tags: [Auth]
 *     description: >
 *       Verifies the 6-digit OTP (stored in Redis) and updates the user's password.
 *       The OTP is deleted immediately after use so it cannot be reused.
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
 *             example:
 *               success: true
 *               message: "Password reset correctly! You can now log in."
 *       400:
 *         description: OTP expired or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "OTP is invalid or has expired"
 *       401:
 *         description: Incorrect OTP code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Incorrect OTP code"
 */
router.post('/reset-password', validate(resetPasswordSchema), resetPasswordController);

export default router;