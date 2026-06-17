import express from "express";
import router from "./modules/auth/routes/local-auth.routes.js";
import cookieParser  from "cookie-parser";
const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth",router);
export default app;