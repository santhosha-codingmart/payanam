import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../modules/users/models/user.model.js";
import { Aircraft } from "../modules/flights/models/aircraft.model.js";
import { FlightRoute } from "../modules/flights/models/flightRoute.model.js";
import { FlightSchedule } from "../modules/flights/models/flightSchedule.model.js";
import { Airport } from "../modules/flights/models/airport.model.js";
import bcrypt from "bcrypt";

dotenv.config();

function generateSeatLayout() {
    const seats = [];
    const letters = ["A", "B", "C", "D", "E", "F"];
    // 30 rows of 6 seats = 180 seats
    for (let row = 1; row <= 30; row++) {
        for (let col = 1; col <= 6; col++) {
            const letter = letters[col - 1];
            let seatType = "middle";
            if (col === 1 || col === 6) seatType = "window";
            else if (col === 3 || col === 4) seatType = "aisle";

            seats.push({
                seatNumber: `${row}${letter}`,
                cabinClass: "ECONOMY",
                seatType: seatType,
                row: row,
                column: col,
                isExtraLegroom: row === 1 || row === 12 || row === 13,
                isEmergencyExit: row === 12 || row === 13,
                fare: 0, // This is just the offset fare
            });
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

async function seedFlights() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Clear existing data
        await Aircraft.deleteMany({});
        await FlightRoute.deleteMany({});
        await FlightSchedule.deleteMany({});

        console.log("Cleared old flight data");

        // Create or get vendor
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("vendor123", salt);
        
        let vendor = await User.findOne({ email: "flight.vendor@payanam.com" });
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

        // Ensure airports exist
        const dbAirports = {};
        for (const ap of airportsData) {
            let existing = await Airport.findOne({ iataCode: ap.iataCode });
            if (!existing) {
                existing = await Airport.create({ ...ap, popularity: 100 });
            }
            dbAirports[ap.iataCode] = existing;
        }

        // Create Aircrafts
        const aircrafts = [];
        const seatLayout = generateSeatLayout();
        for (let i = 1; i <= 5; i++) {
            const ac = await Aircraft.create({
                operatorId: vendor._id,
                operatorName: "IndiGo Airlines",
                airlineName: "IndiGo",
                registrationNumber: `VT-IG${i}`,
                manufacturer: "AIRBUS",
                aircraftModel: "A320neo",
                aircraftType: "AIRBUS_A320NEO",
                cabinClasses: ["ECONOMY"],
                totalSeats: 180,
                economySeats: 180,
                premiumEconomySeats: 0,
                businessSeats: 0,
                firstClassSeats: 0,
                amenities: ["WiFi", "Meal", "Snack", "Extra Legroom"],
                seatLayout: seatLayout,
            });
            aircrafts.push(ac);
        }
        console.log("Created 5 Aircrafts");

        // Create Routes between all combinations of airports
        const routes = [];
        const cities = Object.values(dbAirports);
        for (let i = 0; i < cities.length; i++) {
            for (let j = 0; j < cities.length; j++) {
                if (i !== j) {
                    const source = cities[i];
                    const destination = cities[j];
                    
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
                            }
                        ],
                        distanceInKm: 1200,
                        estimatedDurationInMinutes: 120,
                    });
                    routes.push(route);
                }
            }
        }
        console.log(`Created ${routes.length} routes`);

        // Create Schedules (~300)
        let scheduleCount = 0;
        const today = new Date();
        
        // Distribute dates over next 7 days for the 56 routes
        for (const route of routes) {
            const flight = await Aircraft.findById(route.flightId);
            for (let d = 1; d <= 6; d++) {
                const date = new Date(today);
                date.setDate(date.getDate() + d);
                
                // create random hours
                const hour = Math.floor(Math.random() * 14) + 6; // 6 AM to 8 PM
                const depTime = `${hour.toString().padStart(2, '0')}:00`;
                const arrTime = `${(hour + 2).toString().padStart(2, '0')}:00`;
                
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

                try {
                    await FlightSchedule.create({
                        routeId: route._id,
                        flightId: flight._id,
                        flightNumber: `6E-${Math.floor(100 + Math.random() * 900)}`,
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
                            { hoursBeforeDeparture: 24, refundPercentage: 75 },
                            { hoursBeforeDeparture: 12, refundPercentage: 50 },
                            { hoursBeforeDeparture: 6,  refundPercentage: 25 },
                            { hoursBeforeDeparture: 0,  refundPercentage: 0  },
                        ]
                    });
                    scheduleCount++;
                } catch (e) {
                    // Ignore duplicate key error (11000) for same flightId + date + time
                    if (e.code !== 11000) {
                        throw e;
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
