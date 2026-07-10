import express from "express";
import { searchAirportsController } from "../controllers/airport.controller.js";

const router = express.Router();
router.get("/search", searchAirportsController);

export default router;
