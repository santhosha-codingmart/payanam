import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../modules/users/models/user.model.js";
import { Aircraft } from "../modules/flights/models/aircraft.model.js";
import { FlightRoute } from "../modules/flights/models/flightRoute.model.js";
import { FlightSchedule } from "../modules/flights/models/flightSchedule.model.js";
import { Airport } from "../modules/flights/models/airport.model.js";
import bcrypt from "bcrypt";

dotenv.config();

const airlines = [
  {
    code: "6E",
    name: "IndiGo",
    operator: "IndiGo Airlines",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
      { model: "A321neo", type: "AIRBUS_A321NEO", mfg: "AIRBUS" },
    ],
    amenities: ["WiFi", "Meal", "Snack", "USB Charging"],
    baseFareRange: [3200, 5800],
  },
  {
    code: "AI",
    name: "Air India",
    operator: "Air India Ltd",
    configs: [
      { model: "777-300ER", type: "BOEING_777_300ER", mfg: "BOEING" },
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
    ],
    amenities: ["WiFi", "Meal", "Entertainment", "Blanket", "Pillow", "Alcohol", "Lounge Access"],
    baseFareRange: [4500, 9500],
  },
  {
    code: "SG",
    name: "SpiceJet",
    operator: "SpiceJet Ltd",
    configs: [
      { model: "737 MAX 8", type: "BOEING_737_MAX8", mfg: "BOEING" },
    ],
    amenities: ["Meal", "Snack", "USB Charging"],
    baseFareRange: [2800, 5200],
  },
  {
    code: "UK",
    name: "Vistara",
    operator: "Tata SIA Airlines Ltd",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
      { model: "737 MAX 8", type: "BOEING_737_MAX8", mfg: "BOEING" },
    ],
    amenities: ["WiFi", "Meal", "Entertainment", "Blanket", "USB Charging", "Streaming Entertainment"],
    baseFareRange: [3800, 7200],
  },
  {
    code: "G8",
    name: "Go First",
    operator: "Go First Pvt Ltd",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
    ],
    amenities: ["Snack", "USB Charging"],
    baseFareRange: [2600, 4800],
  },
  {
    code: "I5",
    name: "AirAsia India",
    operator: "AirAsia India Ltd",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
    ],
    amenities: ["Meal", "Snack", "USB Charging", "Priority Boarding"],
    baseFareRange: [2500, 4600],
  },
  {
    code: "QP",
    name: "Akasa Air",
    operator: "SNV Aviation Pvt Ltd",
    configs: [
      { model: "737 MAX 8", type: "BOEING_737_MAX8", mfg: "BOEING" },
    ],
    amenities: ["WiFi", "Meal", "Snack", "USB Charging", "Streaming Entertainment"],
    baseFareRange: [2900, 5400],
  },
  {
    code: "9I",
    name: "Alliance Air",
    operator: "Alliance Air Aviation Ltd",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
    ],
    amenities: ["Snack", "USB Charging"],
    baseFareRange: [2400, 4200],
  },
  {
    code: "S5",
    name: "Star Air",
    operator: "Star Air Pvt Ltd",
    configs: [
      { model: "A320neo", type: "AIRBUS_A320NEO", mfg: "AIRBUS" },
    ],
    amenities: ["Snack"],
    baseFareRange: [2200, 3800],
  },
  {
    code: "IX",
    name: "Air India Express",
    operator: "Air India Express Ltd",
    configs: [
      { model: "737 MAX 8", type: "BOEING_737_MAX8", mfg: "BOEING" },
    ],
    amenities: ["Meal", "Snack", "USB Charging"],
    baseFareRange: [3000, 5600],
  },
];

function generateSeatLayout(aircraftType) {
  const seats = [];
  if (aircraftType === "AIRBUS_A320NEO" || aircraftType === "AIRBUS_A321NEO") {
    const totalRows = aircraftType === "AIRBUS_A321NEO" ? 34 : 30;
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (let row = 1; row <= totalRows; row++) {
      const cabinClass = row <= 5 ? "PREMIUM_ECONOMY" : "ECONOMY";
      const baseFareAdd = row <= 5 ? 2000 : 0;
      for (let col = 1; col <= 6; col++) {
        const letter = letters[col - 1];
        let seatType = "middle";
        if (col === 1 || col === 6) seatType = "window";
        else if (col === 3 || col === 4) seatType = "aisle";
        seats.push({
          seatNumber: `${row}${letter}`,
          cabinClass,
          seatType,
          row,
          column: col,
          isExtraLegroom: row === 1 || row === 12 || row === 13,
          isEmergencyExit: row === 12 || row === 13,
          fare: baseFareAdd,
        });
      }
    }
  } else if (aircraftType === "BOEING_777_300ER") {
    const firstLetters = ["A", "E", "F", "K"];
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 4; col++) {
        seats.push({
          seatNumber: `${row}${firstLetters[col - 1]}`,
          cabinClass: "FIRST",
          seatType: col === 1 || col === 4 ? "window" : "aisle",
          row,
          column: col,
          isExtraLegroom: true,
          isEmergencyExit: false,
          fare: 15000,
        });
      }
    }
    for (let row = 3; row <= 10; row++) {
      for (let col = 1; col <= 4; col++) {
        seats.push({
          seatNumber: `${row}${firstLetters[col - 1]}`,
          cabinClass: "BUSINESS",
          seatType: col === 1 || col === 4 ? "window" : "aisle",
          row,
          column: col,
          isExtraLegroom: true,
          isEmergencyExit: false,
          fare: 8000,
        });
      }
    }
    const econLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"];
    for (let row = 11; row <= 40; row++) {
      for (let col = 1; col <= 10; col++) {
        let seatType = "middle";
        if (col === 1 || col === 10) seatType = "window";
        else if (col === 3 || col === 4 || col === 7 || col === 8)
          seatType = "aisle";
        seats.push({
          seatNumber: `${row}${econLetters[col - 1]}`,
          cabinClass: "ECONOMY",
          seatType,
          row,
          column: col,
          isExtraLegroom: row === 11 || row === 25,
          isEmergencyExit: row === 25,
          fare: 0,
        });
      }
    }
  } else if (aircraftType === "BOEING_737_MAX8") {
    const bizLetters = ["A", "C", "D", "F"];
    for (let row = 1; row <= 4; row++) {
      for (let col = 1; col <= 4; col++) {
        seats.push({
          seatNumber: `${row}${bizLetters[col - 1]}`,
          cabinClass: "BUSINESS",
          seatType: col === 1 || col === 4 ? "window" : "aisle",
          row,
          column: col,
          isExtraLegroom: true,
          isEmergencyExit: false,
          fare: 6000,
        });
      }
    }
    const econLetters = ["A", "B", "C", "D", "E", "F"];
    for (let row = 5; row <= 30; row++) {
      for (let col = 1; col <= 6; col++) {
        let seatType = "middle";
        if (col === 1 || col === 6) seatType = "window";
        else if (col === 3 || col === 4) seatType = "aisle";
        seats.push({
          seatNumber: `${row}${econLetters[col - 1]}`,
          cabinClass: "ECONOMY",
          seatType,
          row,
          column: col,
          isExtraLegroom: row === 5 || row === 14,
          isEmergencyExit: row === 14,
          fare: 0,
        });
      }
    }
  }
  return seats;
}

const airportsData = [
  { iataCode: "DEL", name: "Indira Gandhi International Airport", city: "Delhi", country: "India" },
  { iataCode: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", city: "Mumbai", country: "India" },
  { iataCode: "BLR", name: "Kempegowda International Airport", city: "Bangalore", country: "India" },
  { iataCode: "MAA", name: "Chennai International Airport", city: "Chennai", country: "India" },
  { iataCode: "HYD", name: "Rajiv Gandhi International Airport", city: "Hyderabad", country: "India" },
  { iataCode: "CCU", name: "Netaji Subhas Chandra Bose International Airport", city: "Kolkata", country: "India" },
  { iataCode: "PNQ", name: "Pune Airport", city: "Pune", country: "India" },
  { iataCode: "GOI", name: "Goa International Airport", city: "Goa", country: "India" },
];

const routePairs = [
  { src: "DEL", dest: "BOM", distKm: 1400, durationMin: 130 },
  { src: "BOM", dest: "DEL", distKm: 1400, durationMin: 130 },
  { src: "BLR", dest: "MAA", distKm: 340, durationMin: 60 },
  { src: "MAA", dest: "BLR", distKm: 340, durationMin: 60 },
  { src: "DEL", dest: "BLR", distKm: 1740, durationMin: 165 },
  { src: "BLR", dest: "DEL", distKm: 1740, durationMin: 165 },
  { src: "DEL", dest: "HYD", distKm: 1260, durationMin: 120 },
  { src: "HYD", dest: "DEL", distKm: 1260, durationMin: 120 },
  { src: "BOM", dest: "GOI", distKm: 460, durationMin: 65 },
  { src: "GOI", dest: "BOM", distKm: 460, durationMin: 65 },
  { src: "CCU", dest: "BLR", distKm: 1560, durationMin: 155 },
  { src: "BLR", dest: "CCU", distKm: 1560, durationMin: 155 },
];

async function seedFlights() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    await Aircraft.deleteMany({});
    await FlightRoute.deleteMany({});
    await FlightSchedule.deleteMany({});
    console.log("🗑️  Cleared old flight data");

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("vendor123", salt);

    const vendorMap = {};
    for (const airline of airlines) {
      const email = `${airline.code.toLowerCase()}@payanam.com`;
      let vendor = await User.findOne({ email });
      if (!vendor) {
        vendor = await User.create({
          name: airline.operator,
          email,
          password: hashedPassword,
          role: "vendor",
          phoneNo: `+9190000${String(airlines.indexOf(airline) + 10).padStart(4, "0")}`,
          companyName: airline.operator,
          isEmailVerified: true,
          isPhoneVerified: true,
          vendorApprovalStatus: "APPROVED",
        });
      }
      vendorMap[airline.code] = vendor;
    }
    console.log(`👤 Created/found ${Object.keys(vendorMap).length} airline vendor accounts`);

    const dbAirports = {};
    for (const ap of airportsData) {
      let existing = await Airport.findOne({ iataCode: ap.iataCode });
      if (!existing) {
        existing = await Airport.create({ ...ap, popularity: 100 });
      }
      dbAirports[ap.iataCode] = existing;
    }
    console.log(`✈️  ${Object.keys(dbAirports).length} airports ready`);

    const aircraftsByAirline = {};
    let acSerial = 1;
    for (const airline of airlines) {
      aircraftsByAirline[airline.code] = [];
      const vendor = vendorMap[airline.code];
      const numAircraft = airline.configs.length * 3;
      for (let i = 0; i < numAircraft; i++) {
        const config = airline.configs[i % airline.configs.length];
        const seatLayout = generateSeatLayout(config.type);
        const total = seatLayout.length;
        const econ = seatLayout.filter((s) => s.cabinClass === "ECONOMY").length;
        const prem = seatLayout.filter((s) => s.cabinClass === "PREMIUM_ECONOMY").length;
        const stdEcon = seatLayout.filter((s) => s.cabinClass === "STANDARD_ECONOMY").length;
        const biz = seatLayout.filter((s) => s.cabinClass === "BUSINESS").length;
        const bizSaver = seatLayout.filter((s) => s.cabinClass === "BUSINESS_SAVER").length;
        const first = seatLayout.filter((s) => s.cabinClass === "FIRST").length;
        const cabinClassesSet = new Set(seatLayout.map((s) => s.cabinClass));
        const ac = await Aircraft.create({
          operatorId: vendor._id,
          operatorName: airline.operator,
          airlineName: airline.name,
          registrationNumber: `VT-${airline.code}${String(acSerial).padStart(2, "0")}`,
          manufacturer: config.mfg,
          aircraftModel: config.model,
          aircraftType: config.type,
          cabinClasses: Array.from(cabinClassesSet),
          totalSeats: total,
          economySeats: econ,
          premiumEconomySeats: prem,
          standardEconomySeats: stdEcon,
          businessSeats: biz,
          businessSaverSeats: bizSaver,
          firstClassSeats: first,
          amenities: airline.amenities,
          seatLayout,
          averageRating: +(3.5 + Math.random() * 1.5).toFixed(1),
          totalRatings: Math.floor(50 + Math.random() * 500),
        });
        aircraftsByAirline[airline.code].push(ac);
        acSerial++;
      }
    }
    const totalAircraft = Object.values(aircraftsByAirline).reduce((s, a) => s + a.length, 0);
    console.log(`🛩️  Created ${totalAircraft} aircraft across ${airlines.length} airlines`);

    const allRoutes = [];
    for (const pair of routePairs) {
      const source = dbAirports[pair.src];
      const destination = dbAirports[pair.dest];
      const airlinesToAssign = airlines.slice(0, 6 + Math.floor(Math.random() * 4));
      for (const airline of airlinesToAssign) {
        const acList = aircraftsByAirline[airline.code];
        if (acList.length === 0) continue;
        const aircraft = acList[Math.floor(Math.random() * acList.length)];
        const route = await FlightRoute.create({
          flightId: aircraft._id,
          source: {
            name: source.name,
            iataCode: source.iataCode,
            city: source.city,
            country: source.country,
          },
          destination: {
            name: destination.name,
            iataCode: destination.iataCode,
            city: destination.city,
            country: destination.country,
          },
          stops: [
            {
              name: source.name,
              iataCode: source.iataCode,
              city: source.city,
              country: source.country,
              arrivalTime: "00:00",
              departureTime: "00:00",
              minutesFromSource: 0,
              order: 1,
            },
            {
              name: destination.name,
              iataCode: destination.iataCode,
              city: destination.city,
              country: destination.country,
              arrivalTime: "00:00",
              departureTime: "00:00",
              minutesFromSource: pair.durationMin,
              order: 2,
            },
          ],
          distanceInKm: pair.distKm,
          estimatedDurationInMinutes: pair.durationMin,
        });
        allRoutes.push({ route, airline, aircraft, pair });
      }
    }
    console.log(`🛤️  Created ${allRoutes.length} routes (multiple airlines per route pair)`);

    let scheduleCount = 0;
    const today = new Date("2026-07-23");
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dailySchedules = [];

      for (const { route, airline, aircraft, pair } of allRoutes) {
        const vendor = vendorMap[airline.code];
        const flightsPerDay = 3 + Math.floor(Math.random() * 3);
        const allSlots = [];
        for (let h = 5; h <= 23; h++) {
          for (const m of [0, 15, 30, 45]) {
            allSlots.push({ hour: h, minute: m });
          }
        }
        for (let i = allSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
        }
        const selectedSlots = allSlots.slice(0, flightsPerDay);
        selectedSlots.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

        for (let f = 0; f < flightsPerDay; f++) {
          const hour = selectedSlots[f].hour;
          const minute = selectedSlots[f].minute;
          const depTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          const arrTotalMin = hour * 60 + minute + pair.durationMin;
          const arrHour = Math.floor(arrTotalMin / 60) % 24;
          const arrMinute = arrTotalMin % 60;
          const arrTime = `${String(arrHour).padStart(2, "0")}:${String(arrMinute).padStart(2, "0")}`;

          const [minFare, maxFare] = airline.baseFareRange;
          const baseFare = minFare + Math.floor(Math.random() * (maxFare - minFare));
          const flightNum = `${airline.code}-${Math.floor(100 + Math.random() * 900)}`;

          const seats = aircraft.seatLayout.map((seat) => ({
            seatNumber: seat.seatNumber,
            cabinClass: seat.cabinClass,
            seatType: seat.seatType,
            row: seat.row,
            column: seat.column,
            isExtraLegroom: seat.isExtraLegroom,
            fare: baseFare + (seat.fare || 0),
            status: "AVAILABLE",
            bookedBy: null,
            passengerName: null,
            passengerAge: null,
            passengerGender: null,
          }));

          const arrivalDate = new Date(date);
          if (arrTotalMin >= 1440) arrivalDate.setDate(arrivalDate.getDate() + 1);

          dailySchedules.push({
            routeId: route._id,
            flightId: aircraft._id,
            flightNumber: flightNum,
            operatorId: vendor._id,
            departureDate: date,
            arrivalDate,
            departureTime: depTime,
            arrivalTime: arrTime,
            baseFare,
            availableSeats: seats.length,
            seats,
            departureTerminal: pair.src === "DEL" ? "T3" : pair.src === "BOM" ? "T2" : "T1",
            arrivalTerminal: pair.dest === "DEL" ? "T3" : pair.dest === "BOM" ? "T2" : "T1",
            mealOptions: ["VEG", "NON_VEG"],
            cancellationPolicy: [
              { hoursBeforeDeparture: 24, refundPercentage: 75 },
              { hoursBeforeDeparture: 12, refundPercentage: 50 },
              { hoursBeforeDeparture: 6, refundPercentage: 25 },
              { hoursBeforeDeparture: 0, refundPercentage: 0 },
            ],
          });
        }
      }

      if (dailySchedules.length > 0) {
        try {
          await FlightSchedule.insertMany(dailySchedules, { ordered: false });
          scheduleCount += dailySchedules.length;
          console.log(`📅 Day ${d + 1} (${date.toISOString().split("T")[0]}): ${dailySchedules.length} schedules`);
        } catch (e) {
          if (e.insertedDocs) {
            scheduleCount += e.insertedDocs.length;
            console.log(`📅 Day ${d + 1}: ${e.insertedDocs.length} schedules (some duplicates skipped)`);
          }
        }
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log("🎉 FLIGHT SEED COMPLETE!");
    console.log("═".repeat(60));
    console.log(`   ✈️  Airlines:   ${airlines.length}`);
    console.log(`   🛩️  Aircraft:   ${totalAircraft}`);
    console.log(`   🛤️  Routes:     ${allRoutes.length}`);
    console.log(`   📅 Schedules:  ${scheduleCount}`);
    console.log("═".repeat(60));

    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    mongoose.connection.close();
    process.exit(1);
  }
}

seedFlights();
