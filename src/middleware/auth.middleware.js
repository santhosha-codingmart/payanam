import { verifyAccessToken } from "../modules/auth/services/jwt.service.js";
import User from "../modules/users/models/user.model.js";

/**
 * Authentication Middleware
 *
 * Extracts the `accessToken` from the HTTP-only cookie, verifies it using
 * the JWT service, fetches the full user document from MongoDB, and
 * attaches it to `req.user` so downstream controllers can use it.
 *
 * If the token is missing, expired, or the user no longer exists,
 * the request is rejected with a 401.
 */
export const authenticate = async (req, res, next) => {
    try {
        // 1. Read the token from the cookie or Authorization header
        let token = req.cookies?.accessToken;

        // Fallback to Bearer token in headers (useful for Swagger UI / Postman testing)
        if (!token && req.headers.authorization?.startsWith("Bearer ")) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No access token provided. Please log in."
            });
        }

        // 2. Verify the JWT — this throws if expired or tampered
        const decoded = await verifyAccessToken(token);

        // 3. Fetch the full user from MongoDB (excluding the password hash)
        const user = await User.findById(decoded.user_id).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User associated with this token no longer exists."
            });
        }

        // 4b. Check if the account has been banned by an admin
        if (user.isActive === false) {
            return res.status(403).json({
                success: false,
                message: "Your account has been suspended. Please contact support."
            });
        }

        // 5. Attach the user document to the request object
        req.user = user;

        // 6. Pass control to the next middleware/controller
        return next();

    } catch (error) {
        // JWT verification errors (expired, invalid signature, etc.)
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token. Please log in again."
        });
    }
};
