import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../modules/users/models/user.model.js";
import { Aircraft } from "../modules/flights/models/aircraft.model.js";
import { FlightRoute } from "../modules/flights/models/flightRoute.model.js";
import { FlightSchedule } from "../modules/flights/models/flightSchedule.model.js";
import { Airport } from "../modules/flights/models/airport.model.js";
import bcrypt from "bcrypt";

dotenv.config();

function generateSeatLayout(aircraftType) {
  const seats = [];
  if (aircraftType === "AIRBUS_A320NEO") {
    const letters = ["A", "B", "C", "D", "E", "F"];
    for (let row = 1; row <= 30; row++) {
      const cabinClass = row <= 5 ? "PREMIUM_ECONOMY" : "ECONOMY";
      const baseFareAdd = row <= 5 ? 2000 : 0;
      for (let col = 1; col <= 6; col++) {
        const letter = letters[col - 1];
        let seatType = "middle";
        if (col === 1 || col === 6) seatType = "window";
        else if (col === 3 || col === 4) seatType = "aisle";
        seats.push({
          seatNumber: `${row}${letter}`,
          cabinClass: cabinClass,
          seatType: seatType,
          row: row,
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
          row: row,
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
          row: row,
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
          seatType: seatType,
          row: row,
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
          row: row,
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
          seatType: seatType,
          row: row,
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
  {
    iataCode: "DEL",
    name: "Indira Gandhi International Airport",
    city: "Delhi",
    country: "India",
  },
  {
    iataCode: "BOM",
    name: "Chhatrapati Shivaji Maharaj International Airport",
    city: "Mumbai",
    country: "India",
  },
  {
    iataCode: "BLR",
    name: "Kempegowda International Airport",
    city: "Bangalore",
    country: "India",
  },
  {
    iataCode: "MAA",
    name: "Chennai International Airport",
    city: "Chennai",
    country: "India",
  },
  {
    iataCode: "HYD",
    name: "Rajiv Gandhi International Airport",
    city: "Hyderabad",
    country: "India",
  },
  {
    iataCode: "CCU",
    name: "Netaji Subhas Chandra Bose International Airport",
    city: "Kolkata",
    country: "India",
  },
  {
    iataCode: "PNQ",
    name: "Pune Airport",
    city: "Pune",
    country: "India",
  },
  {
    iataCode: "GOI",
    name: "Goa International Airport",
    city: "Goa",
    country: "India",
  },
];

async function seedFlights() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
    await Aircraft.deleteMany({});
    await FlightRoute.deleteMany({});
    await FlightSchedule.deleteMany({});
    console.log("Cleared old flight data");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("vendor123", salt);
    let vendor = await User.findOne({
      email: "flight.vendor@payanam.com",
    });
    if (!vendor) {
      vendor = await User.create({
        name: "Payanam Airlines Admin",
        email: "flight.vendor@payanam.com",
        password: hashedPassword,
        role: "vendor",
        phone: "9876543220",
        businessName: "Indigo Vendor",
        businessType: "flight",
        address: "Delhi",
      });
      console.log("Created vendor user");
    }
    const dbAirports = {};
    for (const ap of airportsData) {
      let existing = await Airport.findOne({
        iataCode: ap.iataCode,
      });
      if (!existing) {
        existing = await Airport.create({
          ...ap,
          popularity: 100,
        });
      }
      dbAirports[ap.iataCode] = existing;
    }
    const aircraftConfigs = [
      {
        model: "A320neo",
        type: "AIRBUS_A320NEO",
        mfg: "AIRBUS",
      },
      {
        model: "777-300ER",
        type: "BOEING_777_300ER",
        mfg: "BOEING",
      },
      {
        model: "737 MAX 8",
        type: "BOEING_737_MAX8",
        mfg: "BOEING",
      },
      {
        model: "A320neo",
        type: "AIRBUS_A320NEO",
        mfg: "AIRBUS",
      },
      {
        model: "777-300ER",
        type: "BOEING_777_300ER",
        mfg: "BOEING",
      },
    ];
    const aircrafts = [];
    for (let i = 0; i < 60; i++) {
      const config = aircraftConfigs[i % aircraftConfigs.length];
      const seatLayout = generateSeatLayout(config.type);
      let total = seatLayout.length;
      let econ = seatLayout.filter((s) => s.cabinClass === "ECONOMY").length;
      let prem = seatLayout.filter(
        (s) => s.cabinClass === "PREMIUM_ECONOMY",
      ).length;
      let biz = seatLayout.filter((s) => s.cabinClass === "BUSINESS").length;
      let first = seatLayout.filter((s) => s.cabinClass === "FIRST").length;
      let cabinClassesSet = new Set(seatLayout.map((s) => s.cabinClass));
      const ac = await Aircraft.create({
        operatorId: vendor._id,
        operatorName: "Payanam Airways",
        airlineName: "Payanam Air",
        registrationNumber: `VT-PA${i + 1}`,
        manufacturer: config.mfg,
        aircraftModel: config.model,
        aircraftType: config.type,
        cabinClasses: Array.from(cabinClassesSet),
        totalSeats: total,
        economySeats: econ,
        premiumEconomySeats: prem,
        businessSeats: biz,
        firstClassSeats: first,
        amenities: ["WiFi", "Meal", "Snack", "Extra Legroom"],
        seatLayout: seatLayout,
      });
      aircrafts.push(ac);
    }
    console.log(`Created ${aircrafts.length} Aircrafts with diverse classes`);
    const routes = [];
    const routePairs = [
      {
        src: "DEL",
        dest: "BOM",
      },
      {
        src: "BOM",
        dest: "DEL",
      },
      {
        src: "BLR",
        dest: "MAA",
      },
      {
        src: "MAA",
        dest: "BLR",
      },
    ];
    for (const pair of routePairs) {
      const source = dbAirports[pair.src];
      const destination = dbAirports[pair.dest];
      const route = await FlightRoute.create({
        flightId: aircrafts[Math.floor(Math.random() * aircrafts.length)]._id,
        operatorId: vendor._id,
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
            arrivalTime: "02:00",
            departureTime: "02:00",
            minutesFromSource: 120,
            order: 2,
          },
        ],
        distanceInKm: 1200,
        estimatedDurationInMinutes: 120,
      });
      routes.push(route);
    }
    console.log(`Created ${routes.length} routes`);
    let scheduleCount = 0;
    const today = new Date("2026-07-13");
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() + d);
      const dailySchedules = [];
      for (const route of routes) {
        const aircraftIdx = aircrafts.findIndex(
          (a) => a._id.toString() === route.flightId.toString(),
        );
        const flight = aircrafts[aircraftIdx];
        if (!flight) continue;
        const flightsToday = 30;
        const allSlots = [];
        for (let h = 0; h < 24; h++) {
          for (let m of [0, 15, 30, 45]) {
            allSlots.push({
              hour: h,
              minute: m,
            });
          }
        }
        for (let i = allSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
        }
        const selectedSlots = allSlots.slice(0, 30);
        for (let f = 0; f < flightsToday; f++) {
          let hour = selectedSlots[f].hour;
          let minute = selectedSlots[f].minute;
          const depTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
          const arrHour = (hour + 2) % 24;
          const arrTime = `${arrHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
          const baseFare = 4000 + Math.floor(Math.random() * 4000);
          const seats = flight.seatLayout.map((seat) => ({
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
          dailySchedules.push({
            routeId: route._id,
            flightId: flight._id,
            flightNumber: `PA-${Math.floor(1000 + Math.random() * 9000)}`,
            operatorId: vendor._id,
            departureDate: date,
            arrivalDate: date,
            departureTime: depTime,
            arrivalTime: arrTime,
            baseFare: baseFare,
            availableSeats: seats.length,
            seats: seats,
            departureTerminal: "T1",
            arrivalTerminal: "T2",
            mealOptions: ["VEG", "NON_VEG"],
            cancellationPolicy: [
              {
                hoursBeforeDeparture: 24,
                refundPercentage: 75,
              },
              {
                hoursBeforeDeparture: 12,
                refundPercentage: 50,
              },
              {
                hoursBeforeDeparture: 6,
                refundPercentage: 25,
              },
              {
                hoursBeforeDeparture: 0,
                refundPercentage: 0,
              },
            ],
          });
        }
      }
      if (dailySchedules.length > 0) {
        try {
          await FlightSchedule.insertMany(dailySchedules, {
            ordered: false,
          });
          scheduleCount += dailySchedules.length;
          console.log(`Day ${d}: Inserted ${dailySchedules.length} schedules`);
        } catch (e) {
          if (e.insertedDocs) {
            scheduleCount += e.insertedDocs.length;
            console.log(
              `Day ${d}: Inserted ${e.insertedDocs.length} schedules (some duplicates skipped)`,
            );
          }
        }
      }
    }
    console.log(`Successfully seeded ${scheduleCount} flight schedules!`);
    mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    mongoose.connection.close();
    process.exit(1);
  }
}
seedFlights();
