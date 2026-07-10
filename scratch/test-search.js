import mongoose from "mongoose";
import dotenv from "dotenv";
import { searchFlightsService } from "../src/modules/flights/services/flight.service.js";
import { FlightSchedule } from "../src/modules/flights/models/flightSchedule.model.js";
import { FlightRoute } from "../src/modules/flights/models/flightRoute.model.js";

dotenv.config({ path: "../.env" });

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find any schedule
    const sched = await FlightSchedule.findOne().populate('routeId');
    if (!sched) {
        console.log("No schedules in DB");
        return mongoose.connection.close();
    }
    
    const from = sched.routeId.source.iataCode;
    const to = sched.routeId.destination.iataCode;
    const dateStr = sched.departureDate.toISOString().split("T")[0];
    
    console.log(`Testing search: from ${from} to ${to} on ${dateStr}`);
    
    const results = await searchFlightsService(from, to, dateStr);
    console.log(`Found ${results.length} flights`);
    
    mongoose.connection.close();
}

test().catch(console.error);

test().catch(console.error);
