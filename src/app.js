import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import router from "./modules/auth/routes/local-auth.routes.js";
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

// ── Trust proxy (needed for correct IP behind nginx/load balancer) ─────────────
// Without this, req.ip is always the proxy IP, breaking per-IP rate limiting.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());
// Note: express-mongo-sanitize removed — incompatible with Express 5 (read-only req.query).
// MongoDB injection is handled by Zod strict schema validation on all routes,
// which rejects unexpected keys like $gt, $where, $regex before they reach MongoDB.

// ── HTTP Request Logger (morgan → winston) ─────────────────────────────────────
// morgan formats each request as a single line and pipes it into our logger.
// Skips health-check noise in production.
app.use(
    morgan(
        // Custom token: method + url + status + response time + remote IP
        ":method :url :status :response-time ms - :remote-addr",
        {
            stream: {
                write: (message) => logger.info(message.trim()),
            },
            // In production, skip 2xx/3xx responses to reduce noise
            skip: (req, res) =>
                process.env.NODE_ENV === "production" && res.statusCode < 400,
        }
    )
);

// ── Global Rate Limiter ────────────────────────────────────────────────────────
// Applied to ALL routes. Per-route limiters below are ADDITIVE (stricter).
// app.use(globalLimiter);

// ── Swagger UI ────────────────────────────────────────────────────────────────
// Available at: http://localhost:3000/api-docs
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        swaggerOptions: { persistAuthorization: true },
        customSiteTitle: "Payanam API Docs",
    })
);

// Expose the raw OpenAPI JSON so frontend tooling can import it
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth — strict limiter (brute-force protection)
// app.use("/api/auth", authLimiter);
// app.use("/api/auth/mobile/send-otp", otpLimiter);  // OTP sub-limiter (SMS cost)
app.use("/api/auth", router);

// Users
app.use("/api/users", userRouter);

// Bus — search sub-limiter
app.use("/api/v1/buses/search", searchLimiter);
app.use("/api/v1/buses", busRouter);

// Flights — search sub-limiter
app.use("/api/v1/flights/search", searchLimiter);
app.use("/api/v1/flights", flightRouter);
app.use("/api/v1/airports", airportRouter);

// Bookings
app.use("/api/v1/bookings", bookingRouter);

// Places / AI
app.use("/api/v1/places", placeRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/payments", paymentLimiter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin", adminLimiter);
app.use("/api/v1/admin", adminRouter);

// ── Global Error Handler (must come AFTER all routes) ─────────────────────────
app.use(errorHandler);

export default app;

//rate limiter