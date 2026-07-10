import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import authRouter from "./modules/auth/routes/local-auth.routes.js";
import userRouter from "./modules/users/routes/user.routes.js";
import busRouter from "./modules/bus/routes/bus.route.js";
import flightRouter from "./modules/flights/routes/flight.route.js";
import airportRouter from "./modules/flights/routes/airport.routes.js";
import bookingRouter from "./modules/bookings/routes/booking.routes.js";
import placeRouter from "./modules/places/routes/place.routes.js";
import aiRouter from "./modules/ai/routes/ai.routes.js";
import paymentRouter from "./modules/payments/routes/payment.routes.js";
import adminRouter from "./modules/admin/routes/admin.routes.js";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error.middleware.js";
import swaggerSpec from "./config/swagger.js";
import cors from "cors";
import dotenv from "dotenv";
import logger from "./config/logger.js";
import {
  globalLimiter,
  authLimiter,
  otpLimiter,
  searchLimiter,
  paymentLimiter,
  adminLimiter,
} from "./config/rateLimiter.js";

dotenv.config();
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(
  morgan(":method :url :status :response-time ms - :remote-addr", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
    skip: (req, res) =>
      process.env.NODE_ENV === "production" && res.statusCode < 400,
  }),
);
app.use(globalLimiter);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: "Payanam API Docs",
  }),
);
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});
app.use("/api/auth", authLimiter);
app.use("/api/auth/mobile/send-otp", otpLimiter);
app.use("/api/auth", authRouter);
app.use("/api/users", userRouter);
app.use("/api/v1/buses/search", searchLimiter);
app.use("/api/v1/buses", busRouter);
app.use("/api/v1/flights/search", searchLimiter);
app.use("/api/v1/flights", flightRouter);
app.use("/api/v1/airports", airportRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/places", placeRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/payments", paymentLimiter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin", adminLimiter);
app.use("/api/v1/admin", adminRouter);
app.use(errorHandler);

export default app;
