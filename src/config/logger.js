// =============================================================================
// Logger — Winston instance shared across the entire application
//
// Transports:
//   Console      → coloured, human-readable (dev) or JSON (production)
//   combined-*.log  → all logs at info level and above, rotated daily
//   error-*.log     → error-level only, rotated daily
//
// Usage:
//   import logger from '../config/logger.js';
//   logger.info('Server started on port 3000');
//   logger.warn('Rate limit hit', { ip, route });
//   logger.error('Unexpected crash', { error: err.stack });
// =============================================================================

import winston from "winston";
import "winston-daily-rotate-file";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

// Resolve project root so logs/ is always at the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const LOG_DIR    = path.join(__dirname, "../../logs");

// Ensure the logs directory exists at startup
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// ── Custom readable format for the console ────────────────────────────────────
const devFormat = combine(
    colorize({ all: true }),
    timestamp({ format: "HH:mm:ss" }),
    errors({ stack: true }),
    printf(({ level, message, timestamp, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length
            ? "\n  " + JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")
            : "";
        return stack
            ? `[${timestamp}] ${level}: ${message}\n${stack}${metaStr}`
            : `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
);

// ── JSON format for file transports and production console ───────────────────
const prodFormat = combine(
    timestamp(),
    errors({ stack: true }),
    json()
);

const isProduction = process.env.NODE_ENV === "production";

// ── Transports ────────────────────────────────────────────────────────────────

const transports = [
    // Console — coloured in dev, JSON in production
    new winston.transports.Console({
        format: isProduction ? prodFormat : devFormat,
    }),

    // All logs (info+) — rotated daily, kept 14 days
    new winston.transports.DailyRotateFile({
        dirname:        LOG_DIR,
        filename:       "combined-%DATE%.log",
        datePattern:    "YYYY-MM-DD",
        zippedArchive:  true,
        maxSize:        "20m",
        maxFiles:       "14d",
        level:          "info",
        format:         prodFormat,
    }),

    // Errors only — rotated daily, kept 30 days
    new winston.transports.DailyRotateFile({
        dirname:        LOG_DIR,
        filename:       "error-%DATE%.log",
        datePattern:    "YYYY-MM-DD",
        zippedArchive:  true,
        maxSize:        "10m",
        maxFiles:       "30d",
        level:          "error",
        format:         prodFormat,
    }),
];

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
    level:             isProduction ? "info" : "debug",
    defaultMeta:       { service: "payanam-api" },
    transports,
    // Catch uncaught exceptions and log them before crashing
    exceptionHandlers: [
        new winston.transports.DailyRotateFile({
            dirname:      LOG_DIR,
            filename:     "exceptions-%DATE%.log",
            datePattern:  "YYYY-MM-DD",
            maxFiles:     "30d",
            format:       prodFormat,
        }),
    ],
    // Catch unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.DailyRotateFile({
            dirname:      LOG_DIR,
            filename:     "rejections-%DATE%.log",
            datePattern:  "YYYY-MM-DD",
            maxFiles:     "30d",
            format:       prodFormat,
        }),
    ],
});

export default logger;
