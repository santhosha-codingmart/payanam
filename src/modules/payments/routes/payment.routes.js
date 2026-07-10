import express from "express";
import {
  createOrder,
  verifyPayment,
  paymentFailure,
  getStatus,
} from "../controllers/payment.controller.js";
import { authenticate } from "../../../middleware/auth.middleware.js";

const router = express.Router();
router.post("/create-order", authenticate, createOrder);
router.post("/verify", authenticate, verifyPayment);
router.post("/failure", authenticate, paymentFailure);
router.get("/status/:bookingMongoId", authenticate, getStatus);

export default router;
