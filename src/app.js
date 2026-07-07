import express from "express";
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
import dotenv from "dotenv"

dotenv.config();

const app = express();

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json());
app.use(cookieParser());

// ── Swagger UI ────────────────────────────────────────────────────────────────
// Available at: http://localhost:3000/api-docs
app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        // Persist auth between page refreshes
        swaggerOptions: { persistAuthorization: true },
        customSiteTitle: "Payanam API Docs",
    })
);

// Expose the raw OpenAPI JSON so frontend tooling (e.g. Postman, openapi-fetch) can import it
app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/auth", router);
app.use("/api/users", userRouter);
app.use("/api/v1/buses", busRouter);
app.use("/api/v1/flights", flightRouter);
app.use("/api/v1/airports", airportRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/places", placeRouter);
app.use("/api/v1/ai", aiRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/admin",    adminRouter);

// ── Global Error Handler (must come AFTER all routes) ─────────────────────────
app.use(errorHandler);

export default app;