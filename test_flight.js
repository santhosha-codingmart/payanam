import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

import { FlightRoute } from "./src/modules/flights/models/flightRoute.model.js";
import { FlightSchedule } from "./src/modules/flights/models/flightSchedule.model.js";

async function run() {
    const schedules = await FlightSchedule.find({}).populate('routeId');
    console.log("SCHEDULES:", JSON.stringify(schedules, null, 2));
    mongoose.disconnect();
}
run();
