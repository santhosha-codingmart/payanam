import logger from "../config/logger.js";

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const logLevel = statusCode >= 500 ? "error" : "warn";
  logger[logLevel](`${req.method} ${req.originalUrl} → ${statusCode}`, {
    statusCode,
    message,
    ip: req.ip,
    body: statusCode >= 500 ? req.body : undefined,
    stack: err.stack,
  });
  return res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};
