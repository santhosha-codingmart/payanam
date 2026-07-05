import express from "express";
import { aiChatController } from "../controllers/ai.controller.js";

const router = express.Router();

// POST /api/v1/ai/chat
router.post("/chat", aiChatController);

export default router;