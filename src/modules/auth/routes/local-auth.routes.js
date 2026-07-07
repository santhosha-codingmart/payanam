import express from "express";

import {
    login,
    refresh,
    register,
    registerVendor,
    registerAdmin,
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
    registerVendorSchema,
    registerAdminSchema,
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
 * /api/auth/register-vendor:
 *   post:
 *     summary: Register a new vendor account
 *     description: >
 *       Creates a vendor account with `role: "vendor"` automatically assigned
 *       by the server. The client **never** sends the role field.
 *
 *       After registration, the vendor can:
 *       - Create buses via `POST /api/v1/buses`
 *       - Define routes via `POST /api/v1/buses/routes`
 *       - Create schedules via `POST /api/v1/buses/schedules`
 *     tags: [Auth - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, companyName, gstNumber]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Parveen Kumar"
 *                 description: "Full name of the vendor contact person"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contact@parveentravels.com"
 *               password:
 *                 type: string
 *                 example: "SecurePass@123"
 *                 description: "Min 8 chars, must have uppercase, lowercase, digit, special char"
 *               phoneNo:
 *                 type: string
 *                 example: "+919876543210"
 *                 description: "Optional. E.164 format."
 *               companyName:
 *                 type: string
 *                 example: "Parveen Travels Pvt. Ltd."
 *                 description: "The trading name displayed to passengers"
 *               gstNumber:
 *                 type: string
 *                 example: "33AABCP1234A1ZX"
 *                 description: "Required. Indian GST registration number for tax invoicing."
 *           example:
 *             name: "Parveen Kumar"
 *             email: "contact@parveentravels.com"
 *             password: "SecurePass@123"
 *             phoneNo: "+919876543210"
 *             companyName: "Parveen Travels Pvt. Ltd."
 *             gstNumber: "33AABCP1234A1ZX"
 *     responses:
 *       201:
 *         description: Vendor registered. Auth cookies set.
 *         headers:
 *           Set-Cookie:
 *             description: "accessToken=<jwt>; HttpOnly | refreshToken=<jwt>; HttpOnly"
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               message: "Vendor registered successfully. Welcome to Payanam!"
 *               user:
 *                 id: "665f1a2b3c4d5e6f7a8b9c0d"
 *                 name: "Parveen Kumar"
 *                 email: "contact@parveentravels.com"
 *                 role: "vendor"
 *                 companyName: "Parveen Travels Pvt. Ltd."
 *       400:
 *         description: Validation error (missing required fields, weak password, invalid GST)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email or phone number already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "This email is already registered."
 */
router.post('/register-vendor', validate(registerVendorSchema), registerVendor);

/**
 * @swagger
 * /api/auth/register-admin:
 *   post:
 *     summary: Register a new admin account
 *     description: >
 *       Creates an admin account with `role: "admin"` automatically assigned
 *       by the server. Requires a valid admin secret key (ADMIN_SECRET_KEY env variable)
 *       to prevent unauthorized admin account creation.
 *
 *       After registration, the admin can:
 *       - Access the admin dashboard
 *       - Manage vendors, users, bookings
 *       - View platform analytics
 *     tags: [Auth - Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, adminSecretKey]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Admin User"
 *                 description: "Full name of the admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@payanam.com"
 *               password:
 *                 type: string
 *                 example: "SecurePass@123"
 *                 description: "Min 8 chars, must have uppercase, lowercase, digit, special char"
 *               adminSecretKey:
 *                 type: string
 *                 example: "your-secret-admin-key"
 *                 description: "Secret key from ADMIN_SECRET_KEY env variable"
 *     responses:
 *       201:
 *         description: Admin registered. Auth cookies set.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               message: "Admin registered successfully. Welcome to Payanam!"
 *               user:
 *                 id: "665f1a2b3c4d5e6f7a8b9c0d"
 *                 name: "Admin User"
 *                 email: "admin@payanam.com"
 *                 role: "admin"
 *       400:
 *         description: Validation error
 *       403:
 *         description: Invalid admin secret key
 *       409:
 *         description: Email already registered
 */
router.post('/register-admin', validate(registerAdminSchema), registerAdmin);

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
 *       Returns a 404 if the email does not exist in the system.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully.
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
 *       404:
 *         description: User with this email does not exist
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