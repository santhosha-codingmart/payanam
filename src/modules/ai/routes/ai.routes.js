import express from "express";
import { aiChatController } from "../controllers/ai.controller.js";

const router = express.Router();
router.post("/chat", aiChatController);

export default router;
