import logger from "../config/logger.js";

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes in app.js (Express convention).
 *
 * Logs every error through Winston so it appears in:
 *   - Coloured console (dev)  /  JSON console (production)
 *   - logs/error-YYYY-MM-DD.log
 *   - logs/combined-YYYY-MM-DD.log
 */
export const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message    = err.message    || "Internal Server Error";

    // Anything that is genuinely unexpected (500) should be logged at error level.
    // Client errors (4xx) are logged at warn level — not actionable by us.
    const logLevel = statusCode >= 500 ? "error" : "warn";

    logger[logLevel](`${req.method} ${req.originalUrl} → ${statusCode}`, {
        statusCode,
        message,
        ip:      req.ip,
        body:    statusCode >= 500 ? req.body : undefined, // body only for 500s
        stack:   err.stack,
    });

    return res.status(statusCode).json({
        success: false,
        message,
        errors: err.errors || [],
        // Expose stack trace only in development for security
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
};
