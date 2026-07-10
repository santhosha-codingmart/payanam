import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redisClient from "./redis.js";
import logger from "./logger.js";

const redisStore = (prefix) =>
  new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
    prefix: `rl:${prefix}:`,
  });
const makeHandler = (limiterName) => (req, res, _next, options) => {
  logger.warn("Rate limit exceeded", {
    limiter: limiterName,
    ip: req.ip,
    method: req.method,
    url: req.originalUrl,
  });
  res.status(options.statusCode).json({
    success: false,
    message: options.message,
  });
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests. Please slow down and try again in 15 minutes.",
  store: redisStore("global"),
  handler: makeHandler("global"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  store: redisStore("auth"),
  handler: makeHandler("auth"),
  skipSuccessfulRequests: true,
});

export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many OTP requests. Please wait 15 minutes before requesting another OTP.",
  store: redisStore("otp"),
  handler: makeHandler("otp"),
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many search requests. Please wait a moment before searching again.",
  store: redisStore("search"),
  handler: makeHandler("search"),
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message:
    "Too many payment requests from this IP. Please contact support if this is unexpected.",
  store: redisStore("payment"),
  handler: makeHandler("payment"),
});

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Admin rate limit exceeded. Please slow down.",
  store: redisStore("admin"),
  handler: makeHandler("admin"),
});
