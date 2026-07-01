import express from "express";
import { getProfile, updateProfile, getVendorDashboard } from "../controllers/user.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { authorize } from "../../../middleware/role.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import { updateProfileSchema } from "../validators/user.validator.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Swagger JSDoc annotations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Users
 *     description: User profile management (requires authentication)
 */

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get the logged-in user's profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/profile", authenticate, getProfile);

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update the logged-in user's profile
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     description: >
 *       All fields are optional. Only the fields provided in the body
 *       will be updated. Email and phone uniqueness is enforced.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email or phone already taken by another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put("/profile", authenticate, validate(updateProfileSchema), updateProfile);

/**
 * @swagger
 * /api/users/vendor/dashboard:
 *   get:
 *     summary: Get vendor dashboard summary
 *     description: >
 *       Returns a single aggregated response for the vendor dashboard,
 *       including bus/flight counts, upcoming schedule counts, total
 *       confirmed bookings, and total revenue. All queries run in parallel
 *       so this is a single fast call for the frontend.
 *     tags: [Users]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorDashboardResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a vendor or admin
 */
router.get(
    "/vendor/dashboard",
    authenticate,
    authorize("vendor", "admin"),
    getVendorDashboard
);

export default router;
