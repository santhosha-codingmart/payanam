import express from "express";
import swaggerUi from "swagger-ui-express";
import router from "./modules/auth/routes/local-auth.routes.js";
import userRouter from "./modules/users/routes/user.routes.js";
import busRouter from "./modules/bus/routes/bus.route.js";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/error.middleware.js";
import swaggerSpec from "./config/swagger.js";

const app = express();

app.use(
    cors({
        origin: process.env.CLIENT_URL,
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

// ── Global Error Handler (must come AFTER all routes) ─────────────────────────
app.use(errorHandler);

export default app;