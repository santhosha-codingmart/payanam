import mongoose from "mongoose";
import dotenv from "dotenv";
import { FlightRoute } from "./src/modules/flights/models/flightRoute.model.js";
import { FlightSchedule } from "./src/modules/flights/models/flightSchedule.model.js";

dotenv.config();

const debugSearch = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find the schedules we know exist
    const schedules = await FlightSchedule.find({
      flightNumber: { $in: ["6E-204", "6E-987"] }
    })
    .populate("routeId")
    .populate("flightId");

    console.log(`Found ${schedules.length} schedules\n`);

    for (const schedule of schedules) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Flight: ${schedule.flightNumber}`);
      console.log(`Schedule ID: ${schedule._id}`);
      console.log(`Route ID: ${schedule.routeId?._id}`);
      
      const route = schedule.routeId;
      if (route) {
        console.log(`\nRoute Structure:`);
        console.log(`  Source: ${route.source?.city} (${route.source?.iataCode})`);
        console.log(`  Destination: ${route.destination?.city} (${route.destination?.iataCode})`);
        console.log(`  Status: ${route.status}`);
        console.log(`  Stops Count: ${route.stops?.length || 0}`);
        
        if (route.stops && route.stops.length > 0) {
          console.log(`\n  Stops Array:`);
          route.stops.forEach((stop, idx) => {
            console.log(`    ${idx + 1}. ${stop.city} (${stop.iataCode}) - Order: ${stop.order}`);
          });
        } else {
          console.log(`  ⚠️  Stops array is EMPTY!`);
        }
      } else {
        console.log(`\n⚠️  Route not populated!`);
      }
      console.log(``);
    }

    // Now let's manually test the search query
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Testing Search Query Logic:`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const from = "DEL";
    const to = "TRZ";
    const date = "2026-07-04";

    const fromRegex = new RegExp(`^${from}$`, "i");
    const toRegex = new RegExp(`^${to}$`, "i");

    console.log(`Search params: from=${from}, to=${to}, date=${date}`);
    console.log(`From regex: ${fromRegex}`);
    console.log(`To regex: ${toRegex}\n`);

    // Find matching routes
    const routes = await FlightRoute.find({
      status: "ACTIVE",
      $and: [
        {
          $or: [
            { "source.iataCode": fromRegex },
            { "source.city": fromRegex },
            { "stops.iataCode": fromRegex },
            { "stops.city": fromRegex },
          ],
        },
        {
          $or: [
            { "destination.iataCode": toRegex },
            { "destination.city": toRegex },
            { "stops.iataCode": toRegex },
            { "stops.city": toRegex },
          ],
        },
      ],
    });

    console.log(`Found ${routes.length} matching routes\n`);

    if (routes.length > 0) {
      routes.forEach((route, idx) => {
        console.log(`Route ${idx + 1}:`);
        console.log(`  Source: ${route.source?.city} (${route.source?.iataCode})`);
        console.log(`  Destination: ${route.destination?.city} (${route.destination?.iataCode})`);
        console.log(`  Status: ${route.status}`);
        console.log(`  Stops: ${route.stops?.map(s => `${s.city}(${s.iataCode})[${s.order}]`).join(' → ') || 'None'}`);
        
        // Check direction
        const fromStop = route.stops.find(
          (s) => fromRegex.test(s.iataCode) || fromRegex.test(s.city)
        );
        const toStop = route.stops.find(
          (s) => toRegex.test(s.iataCode) || toRegex.test(s.city)
        );

        console.log(`  From stop found: ${fromStop ? `${fromStop.city} (order: ${fromStop.order})` : 'NO'}`);
        console.log(`  To stop found: ${toStop ? `${toStop.city} (order: ${toStop.order})` : 'NO'}`);
        console.log(`  Direction valid: ${fromStop && toStop && fromStop.order < toStop.order ? 'YES ✓' : 'NO ✗'}`);
        console.log(``);
      });
    }

    // Now search for schedules
    const searchDate = new Date(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const routeIds = routes.map(r => r._id);
    
    console.log(`\nSearching for schedules on ${date}...`);
    console.log(`Route IDs: ${routeIds.join(', ')}`);
    console.log(`Date range: ${searchDate.toISOString()} to ${nextDay.toISOString()}\n`);

    const scheduleQuery = {
      routeId: { $in: routeIds },
      departureDate: { $gte: searchDate, $lt: nextDay },
      status: { $in: ["SCHEDULED", "DELAYED", "BOARDING"] },
      availableSeats: { $gt: 0 },
    };

    console.log(`Schedule query: ${JSON.stringify(scheduleQuery, null, 2)}\n`);

    const foundSchedules = await FlightSchedule.find(scheduleQuery)
      .populate("flightId")
      .populate("routeId");

    console.log(`Found ${foundSchedules.length} schedules matching criteria\n`);

    if (foundSchedules.length === 0 && routes.length > 0) {
      console.log(`⚠️  PROBLEM: Routes exist but no schedules found!`);
      console.log(`\nLet's check ALL schedules for these routes (ignoring date):`);
      
      const allSchedules = await FlightSchedule.find({
        routeId: { $in: routeIds }
      }).populate("flightId");
      
      console.log(`Found ${allSchedules.length} total schedules for these routes:`);
      allSchedules.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ${s.flightNumber} - ${s.departureDate.toISOString().split('T')[0]} - Status: ${s.status} - Seats: ${s.availableSeats}`);
      });
    }

    await mongoose.disconnect();
    console.log(`\n✅ Disconnected from MongoDB`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

debugSearch();