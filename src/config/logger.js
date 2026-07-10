import winston from "winston";
import "winston-daily-rotate-file";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../../logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, {
    recursive: true,
  });
}
const { combine, timestamp, printf, colorize, json, errors } = winston.format;
const devFormat = combine(
  colorize({
    all: true,
  }),
  timestamp({
    format: "HH:mm:ss",
  }),
  errors({
    stack: true,
  }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length
      ? "\n  " + JSON.stringify(meta, null, 2).replace(/\n/g, "\n  ")
      : "";
    return stack
      ? `[${timestamp}] ${level}: ${message}\n${stack}${metaStr}`
      : `[${timestamp}] ${level}: ${message}${metaStr}`;
  }),
);
const prodFormat = combine(
  timestamp(),
  errors({
    stack: true,
  }),
  json(),
);
const isProduction = process.env.NODE_ENV === "production";
const transports = [
  new winston.transports.Console({
    format: isProduction ? prodFormat : devFormat,
  }),
  new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: "combined-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    level: "info",
    format: prodFormat,
  }),
  new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "10m",
    maxFiles: "30d",
    level: "error",
    format: prodFormat,
  }),
];
const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  defaultMeta: {
    service: "payanam-api",
  },
  transports,
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: "exceptions-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
      format: prodFormat,
    }),
  ],
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      dirname: LOG_DIR,
      filename: "rejections-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
      format: prodFormat,
    }),
  ],
});

export default logger;
