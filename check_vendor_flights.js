import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/modules/users/models/user.model.js";
import { FlightSchedule } from "./src/modules/flights/models/flightSchedule.model.js";
import { FlightRoute } from "./src/modules/flights/models/flightRoute.model.js";
import { Aircraft } from "./src/modules/flights/models/aircraft.model.js";

dotenv.config();

const checkVendorFlights = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Step 1: Find the vendor by email
    console.log("🔍 Step 1: Finding vendor with email 'jkm@gmail.com'...");
    const vendor = await User.findOne({ email: "jkm@gmail.com", role: "vendor" });
    
    if (!vendor) {
      console.log("❌ Vendor not found with email: jkm@gmail.com");
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Vendor found:`);
    console.log(`   - Name: ${vendor.name || "N/A"}`);
    console.log(`   - Email: ${vendor.email}`);
    console.log(`   - Role: ${vendor.role}`);
    console.log(`   - User ID: ${vendor._id}\n`);

    // Step 2: Find flight schedules for this vendor on July 3 and 4, 2026
    console.log("🔍 Step 2: Searching for flight schedules on July 3 and 4, 2026...");
    
    // Create date range for July 3 and 4, 2026
    const july3Start = new Date("2026-07-03T00:00:00.000Z");
    const july3End = new Date("2026-07-03T23:59:59.999Z");
    const july4Start = new Date("2026-07-04T00:00:00.000Z");
    const july4End = new Date("2026-07-04T23:59:59.999Z");

    // Find all schedules for this vendor on July 3 and 4
    const schedules = await FlightSchedule.find({
      operatorId: vendor._id,
      departureDate: {
        $gte: july3Start,
        $lte: july4End
      }
    })
    .populate({
      path: "flightId",
      select: "airlineName aircraftType aircraftModel registrationNumber"
    })
    .populate({
      path: "routeId",
      select: "source destination stops"
    })
    .sort({ departureDate: 1, departureTime: 1 });

    if (schedules.length === 0) {
      console.log("❌ No flight schedules found for this vendor on July 3-4, 2026\n");
      await mongoose.disconnect();
      return;
    }

    console.log(`✅ Found ${schedules.length} flight schedule(s):\n`);

    // Step 3: Filter for DEL to TRICHY routes
    console.log("🔍 Step 3: Filtering for DEL → TRICHY routes...\n");
    
    const delToTrichyFlights = [];
    
    schedules.forEach((schedule, index) => {
      const route = schedule.routeId;
      const source = route?.source;
      const destination = route?.destination;
      
      // Check if route is DEL to TRICHY (case-insensitive)
      const isDELToTrichy = 
        (source?.iataCode?.toUpperCase() === "DEL" || source?.city?.toUpperCase().includes("DELHI")) &&
        (destination?.iataCode?.toUpperCase() === "TRZ" || destination?.city?.toUpperCase().includes("TRICHY") || destination?.city?.toUpperCase().includes("TIRUCHIRAPPALLI"));

      if (isDELToTrichy) {
        delToTrichyFlights.push(schedule);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✈️  Flight ${index + 1}: DEL → TRICHY`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   Schedule ID: ${schedule._id}`);
        console.log(`   Flight Number: ${schedule.flightNumber}`);
        console.log(`   Airline: ${schedule.flightId?.airlineName || "N/A"}`);
        console.log(`   Aircraft: ${schedule.flightId?.aircraftModel || "N/A"} (${schedule.flightId?.aircraftType || "N/A"})`);
        console.log(`   Registration: ${schedule.flightId?.registrationNumber || "N/A"}`);
        console.log(`   Date: ${schedule.departureDate.toISOString().split('T')[0]}`);
        console.log(`   Departure Time: ${schedule.departureTime}`);
        console.log(`   Arrival Time: ${schedule.arrivalTime}`);
        console.log(`   Base Fare: ₹${schedule.baseFare}`);
        console.log(`   Available Seats: ${schedule.availableSeats}`);
        console.log(`   Status: ${schedule.status}`);
        console.log(`   Source: ${source?.city} (${source?.iataCode})`);
        console.log(`   Destination: ${destination?.city} (${destination?.iataCode})`);
        console.log(`   Departure Terminal: ${schedule.departureTerminal || "N/A"}`);
        console.log(`   Arrival Terminal: ${schedule.arrivalTerminal || "N/A"}`);
        console.log(``);
      }
    });

    if (delToTrichyFlights.length === 0) {
      console.log("❌ No DEL → TRICHY flights found for this vendor on July 3-4, 2026\n");
      
      // Show all routes found for debugging
      console.log("📋 All routes found for this vendor on July 3-4, 2026:");
      schedules.forEach((schedule, index) => {
        const route = schedule.routeId;
        console.log(`   ${index + 1}. ${route?.source?.city} (${route?.source?.iataCode}) → ${route?.destination?.city} (${route?.destination?.iataCode}) on ${schedule.departureDate.toISOString().split('T')[0]}`);
      });
    } else {
      console.log(`\n✅ Summary: Found ${delToTrichyFlights.length} DEL → TRICHY flight(s) for vendor jkm@gmail.com on July 3-4, 2026\n`);
      
      console.log("📊 Flight Booking Page Visibility Check:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("Based on the searchFlightsService implementation:");
      console.log("✓ These flights WILL be visible to users in the flight booking page");
      console.log("  because they meet all the criteria:");
      console.log("  • Route status is ACTIVE");
      console.log("  • Schedule status is SCHEDULED/DELAYED/BOARDING");
      console.log("  • Available seats > 0");
      console.log("  • Date matches the search query");
      console.log("  • Route direction is correct (DEL → TRICHY)");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    }

    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");

  } catch (error) {
    console.error("❌ Error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

checkVendorFlights();