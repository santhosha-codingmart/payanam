import express from "express";
import { searchPlaces } from "../controllers/place.controller.js";

const router = express.Router();
router.get("/search", searchPlaces);

export default router;
