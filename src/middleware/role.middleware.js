/**
 * Role-Based Authorization Middleware
 *
 * This is a "curried" function — you call it with the allowed roles, and it
 * returns an Express middleware that checks `req.user.role`.
 *
 * IMPORTANT: This middleware MUST be used AFTER `authenticate` middleware,
 * because it relies on `req.user` being set.
 *
 * Usage in routes:
 *   router.post("/admin-only", authenticate, authorize("admin"), controller);
 *   router.post("/vendor-or-admin", authenticate, authorize("vendor", "admin"), controller);
 */
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        // Safety check — if authenticate middleware didn't run, req.user won't exist
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in first."
            });
        }

        // Check if the user's role is in the allowed list
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. This action requires one of the following roles: ${allowedRoles.join(", ")}. Your role: ${req.user.role}.`
            });
        }

        // User has the right role — proceed
        return next();
    };
};
