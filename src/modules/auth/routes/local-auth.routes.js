import express from "express";
import {
  login,
  refresh,
  register,
  registerVendor,
  registerAdmin,
  forgotPassword,
  resetPasswordController,
  sendMobileOTPController,
  verifyMobileOTPController,
  logout,
} from "../controllers/local-auth.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { validate } from "../../../middleware/validate.middleware.js";
import {
  loginSchema,
  registerSchema,
  registerVendorSchema,
  registerAdminSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendMobileOTPSchema,
  verifyMobileOTPSchema,
} from "../validators/auth.validator.js";

let authRouter = express.Router();
authRouter.post(
  "/register-vendor",
  validate(registerVendorSchema),
  registerVendor,
);
authRouter.post(
  "/register-admin",
  validate(registerAdminSchema),
  registerAdmin,
);
authRouter.post("/register", validate(registerSchema), register);
authRouter.post("/login", validate(loginSchema), login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", authenticate, logout);
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  forgotPassword,
);
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  resetPasswordController,
);
authRouter.post(
  "/mobile/send-otp",
  validate(sendMobileOTPSchema),
  sendMobileOTPController,
);
authRouter.post(
  "/mobile/verify-otp",
  validate(verifyMobileOTPSchema),
  verifyMobileOTPController,
);

export default authRouter;
