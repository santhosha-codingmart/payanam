export const errorHandler = (err, req, res, next) => {
    // If our Custom ApiError threw the error, it will have a statusCode. 
    // Otherwise, it’s an unexpected crash, so we default to 500.
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    return res.status(statusCode).json({
        success: false,
        message: message,
        errors: err.errors || [], // Pass any validation errors
        // Send the stack trace ONLY when we are developing, hide it in production for security
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
    });
};
