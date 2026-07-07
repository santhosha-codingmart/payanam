// =============================================================================
// Rate Limiters — express-rate-limit + Redis store
//
// All limiters use the existing Redis connection so state is shared across
// multiple server processes (horizontal scaling ready).
//
// Tiers:
//   globalLimiter   → all routes           (300 req / 15 min)
//   authLimiter     → /api/auth/*          (20  req / 15 min) — brute-force
//   otpLimiter      → OTP send endpoints   (5   req / 15 min) — SMS cost
//   searchLimiter   → bus/flight search    (60  req / 1  min)
//   paymentLimiter  → /api/v1/payments/*   (10  req / 1  hour)
//   adminLimiter    → /api/v1/admin/*      (100 req / 15 min)
// =============================================================================

import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "./redis.js";
import logger from "./logger.js";

// ── Helper: build a Redis-backed store with a unique key prefix ───────────────
const redisStore = (prefix) =>
    new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix:      `rl:${prefix}:`,
    });

// ── Helper: build a handler that logs the rate limit event ───────────────────
const makeHandler = (limiterName) => (req, res, _next, options) => {
    logger.warn("Rate limit exceeded", {
        limiter: limiterName,
        ip:      req.ip,
        method:  req.method,
        url:     req.originalUrl,
    });
    res.status(options.statusCode).json({
        success: false,
        message: options.message,
    });
};

// =============================================================================
// GLOBAL — applies to every route via app.use() in app.js
// =============================================================================
export const globalLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,  // 15 minutes
    max:             300,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         "Too many requests. Please slow down and try again in 15 minutes.",
    store:           redisStore("global"),
    handler:         makeHandler("global"),
});

// =============================================================================
// AUTH — POST /api/auth/login, /register, /forgot-password
// skipSuccessfulRequests: only counts failed attempts toward the limit.
// =============================================================================
export const authLimiter = rateLimit({
    windowMs:               15 * 60 * 1000,
    max:                    20,
    standardHeaders:        true,
    legacyHeaders:          false,
    message:                "Too many authentication attempts. Please try again in 15 minutes.",
    store:                  redisStore("auth"),
    handler:                makeHandler("auth"),
    skipSuccessfulRequests: true,
});

// =============================================================================
// OTP — POST /api/auth/mobile/send-otp
// Tight limit — each OTP costs an SMS credit.
// =============================================================================
export const otpLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             5,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         "Too many OTP requests. Please wait 15 minutes before requesting another OTP.",
    store:           redisStore("otp"),
    handler:         makeHandler("otp"),
});

// =============================================================================
// SEARCH — GET /api/v1/buses/search, /api/v1/flights/search
// =============================================================================
export const searchLimiter = rateLimit({
    windowMs:        60 * 1000,  // 1 minute
    max:             60,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         "Too many search requests. Please wait a moment before searching again.",
    store:           redisStore("search"),
    handler:         makeHandler("search"),
});

// =============================================================================
// PAYMENT — all /api/v1/payments/* routes
// =============================================================================
export const paymentLimiter = rateLimit({
    windowMs:        60 * 60 * 1000,  // 1 hour
    max:             10,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         "Too many payment requests from this IP. Please contact support if this is unexpected.",
    store:           redisStore("payment"),
    handler:         makeHandler("payment"),
});

// =============================================================================
// ADMIN — all /api/v1/admin/* routes
// =============================================================================
export const adminLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             200,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         "Admin rate limit exceeded. Please slow down.",
    store:           redisStore("admin"),
    handler:         makeHandler("admin"),
});
