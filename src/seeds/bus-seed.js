import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../modules/users/models/user.model.js";
import { Bus } from "../modules/bus/models/bus.model.js";
import { Route } from "../modules/bus/models/route.model.js";
import { Schedule } from "../modules/bus/models/schedule.model.js";
import bcrypt from "bcrypt";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate seat layout for a bus
// ─────────────────────────────────────────────────────────────────────────────

function generateSeatLayout(layoutType, totalSeats, baseFare) {
    const seats = [];
    let seatIndex = 1;

    if (layoutType === "2+1_SLEEPER") {
        const seatsPerDeck = Math.ceil(totalSeats / 2);
        const rowsPerDeck = Math.ceil(seatsPerDeck / 3);
        for (const deck of ["lower", "upper"]) {
            for (let row = 1; row <= rowsPerDeck && seatIndex <= totalSeats; row++) {
                for (let col = 1; col <= 3 && seatIndex <= totalSeats; col++) {
                    const seatType = col === 2 ? "aisle" : "window";
                    seats.push({
                        seatNumber: `${deck === "lower" ? "L" : "U"}${seatIndex}`,
                        seatType,
                        deck,
                        row,
                        column: col,
                        isSleeper: true,
                        fare: deck === "upper" ? baseFare : baseFare + 100,
                    });
                    seatIndex++;
                }
            }
        }
    } else if (layoutType === "2+2_SEATER") {
        const rows = Math.ceil(totalSeats / 4);
        for (let row = 1; row <= rows && seatIndex <= totalSeats; row++) {
            for (let col = 1; col <= 4 && seatIndex <= totalSeats; col++) {
                const seatType = col === 1 || col === 4 ? "window" : col === 2 ? "aisle" : "middle";
                seats.push({
                    seatNumber: `S${seatIndex}`,
                    seatType,
                    deck: "lower",
                    row,
                    column: col,
                    isSleeper: false,
                    fare: seatType === "window" ? baseFare + 50 : baseFare,
                });
                seatIndex++;
            }
        }
    } else if (layoutType === "1+1_SLEEPER") {
        const seatsPerDeck = Math.ceil(totalSeats / 2);
        const rowsPerDeck = Math.ceil(seatsPerDeck / 2);
        for (const deck of ["lower", "upper"]) {
            for (let row = 1; row <= rowsPerDeck && seatIndex <= totalSeats; row++) {
                for (let col = 1; col <= 2 && seatIndex <= totalSeats; col++) {
                    seats.push({
                        seatNumber: `${deck === "lower" ? "L" : "U"}${seatIndex}`,
                        seatType: "window",
                        deck,
                        row,
                        column: col,
                        isSleeper: true,
                        fare: baseFare + 200,
                    });
                    seatIndex++;
                }
            }
        }
    } else {
        const rows = Math.ceil(totalSeats / 3);
        for (let row = 1; row <= rows && seatIndex <= totalSeats; row++) {
            for (let col = 1; col <= 3 && seatIndex <= totalSeats; col++) {
                const seatType = col === 1 || col === 3 ? "window" : "aisle";
                seats.push({
                    seatNumber: `S${seatIndex}`,
                    seatType,
                    deck: "lower",
                    row,
                    column: col,
                    isSleeper: false,
                    fare: baseFare,
                });
                seatIndex++;
            }
        }
    }
    return seats;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

const vendorUsers = [
    { name: "KPN Travels", email: "kpn@payanam.com", phoneNo: "+919000000001", password: "Vendor@123", role: "vendor", isEmailVerified: true, isPhoneVerified: true },
    { name: "SRS Travels", email: "srs@payanam.com", phoneNo: "+919000000002", password: "Vendor@123", role: "vendor", isEmailVerified: true, isPhoneVerified: true },
    { name: "Orange Travels", email: "orange@payanam.com", phoneNo: "+919000000003", password: "Vendor@123", role: "vendor", isEmailVerified: true, isPhoneVerified: true },
];

const busConfigs = [
    { vendorIndex: 0, busName: "KPN Volvo Multi-Axle", busNumber: "TN01KPN001", registrationNumber: "TN01AB1234", busType: "AC_SLEEPER", seatLayoutType: "2+1_SLEEPER", totalSeats: 36, lowerDeckSeats: 18, upperDeckSeats: 18, sleeperSeats: 36, seaterSeats: 0, isAC: true, isSleeper: true, isSeater: false, amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "GPS Tracking"], isGPSAvailable: true, isLiveTrackingEnabled: true, baseFare: 800 },
    { vendorIndex: 0, busName: "KPN Deluxe Seater", busNumber: "TN01KPN002", registrationNumber: "TN01AB1235", busType: "AC_SEATER", seatLayoutType: "2+2_SEATER", totalSeats: 44, lowerDeckSeats: 44, upperDeckSeats: 0, sleeperSeats: 0, seaterSeats: 44, isAC: true, isSleeper: false, isSeater: true, amenities: ["Charging Point", "Water Bottle", "GPS Tracking"], isGPSAvailable: true, isLiveTrackingEnabled: false, baseFare: 450 },
    { vendorIndex: 1, busName: "SRS Luxury Sleeper", busNumber: "KA01SRS001", registrationNumber: "KA01CD5678", busType: "LUXURY_SLEEPER", seatLayoutType: "1+1_SLEEPER", totalSeats: 24, lowerDeckSeats: 12, upperDeckSeats: 12, sleeperSeats: 24, seaterSeats: 0, isAC: true, isSleeper: true, isSeater: false, amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "Reading Light", "CCTV"], isGPSAvailable: true, isLiveTrackingEnabled: true, baseFare: 1200 },
    { vendorIndex: 1, busName: "SRS Semi-Sleeper", busNumber: "KA01SRS002", registrationNumber: "KA01CD5679", busType: "SEMI_SLEEPER", seatLayoutType: "2+1_SEATER", totalSeats: 36, lowerDeckSeats: 36, upperDeckSeats: 0, sleeperSeats: 0, seaterSeats: 36, isAC: true, isSleeper: false, isSeater: true, amenities: ["Charging Point", "Water Bottle"], isGPSAvailable: false, isLiveTrackingEnabled: false, baseFare: 550 },
    { vendorIndex: 2, busName: "Orange Volvo 9600", busNumber: "AP01ORG001", registrationNumber: "AP01EF9012", busType: "VOLVO_AC", seatLayoutType: "2+1_SLEEPER", totalSeats: 30, lowerDeckSeats: 15, upperDeckSeats: 15, sleeperSeats: 30, seaterSeats: 0, isAC: true, isSleeper: true, isSeater: false, amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "Reading Light", "GPS Tracking", "CCTV"], isGPSAvailable: true, isLiveTrackingEnabled: true, baseFare: 900 },
    { vendorIndex: 2, busName: "Orange Non-AC Seater", busNumber: "AP01ORG002", registrationNumber: "AP01EF9013", busType: "NON_AC_SEATER", seatLayoutType: "2+2_SEATER", totalSeats: 48, lowerDeckSeats: 48, upperDeckSeats: 0, sleeperSeats: 0, seaterSeats: 48, isAC: false, isSleeper: false, isSeater: true, amenities: ["Emergency Exit"], isGPSAvailable: false, isLiveTrackingEnabled: false, baseFare: 300 },
];

const routeConfigs = [
    {
        busConfigIndex: 0,
        source: { city: "Chennai", state: "Tamil Nadu" },
        destination: { city: "Coimbatore", state: "Tamil Nadu" },
        distanceInKm: 510,
        farePerKm: 2.0,
        estimatedDurationInMinutes: 540,
        stops: [
            { city: "Chennai", state: "Tamil Nadu", arrivalTime: "21:30", departureTime: "21:30", distanceFromSource: 0, order: 1 },
            { city: "Salem", state: "Tamil Nadu", arrivalTime: "02:30", departureTime: "02:40", distanceFromSource: 340, order: 2 },
            { city: "Erode", state: "Tamil Nadu", arrivalTime: "04:00", departureTime: "04:10", distanceFromSource: 400, order: 3 },
            { city: "Tiruppur", state: "Tamil Nadu", arrivalTime: "05:00", departureTime: "05:10", distanceFromSource: 450, order: 4 },
            { city: "Coimbatore", state: "Tamil Nadu", arrivalTime: "06:30", departureTime: "06:30", distanceFromSource: 510, order: 5 },
        ],
    },
    {
        busConfigIndex: 1, 
        source: { city: "Madurai", state: "Tamil Nadu" },
        destination: { city: "Coimbatore", state: "Tamil Nadu" },
        distanceInKm: 215,
        farePerKm: 1.5,
        estimatedDurationInMinutes: 240, 
        stops: [
            { city: "Madurai", state: "Tamil Nadu", arrivalTime: "07:00", departureTime: "07:00", distanceFromSource: 0, order: 1 },
            { city: "Dharapuram", state: "Tamil Nadu", arrivalTime: "09:00", departureTime: "09:10", distanceFromSource: 120, order: 2 },
            { city: "Palladam", state: "Tamil Nadu", arrivalTime: "10:15", departureTime: "10:20", distanceFromSource: 180, order: 3 },
            { city: "Coimbatore", state: "Tamil Nadu", arrivalTime: "11:00", departureTime: "11:00", distanceFromSource: 215, order: 4 },
        ],
    },
    {
        busConfigIndex: 0,
        source: { city: "Chennai", state: "Tamil Nadu" },
        destination: { city: "Bangalore", state: "Karnataka" },
        distanceInKm: 350,
        farePerKm: 2.5,
        estimatedDurationInMinutes: 390,
        stops: [
            { city: "Chennai", state: "Tamil Nadu", arrivalTime: "22:00", departureTime: "22:00", distanceFromSource: 0, order: 1 },
            { city: "Vellore", state: "Tamil Nadu", arrivalTime: "00:30", departureTime: "00:40", distanceFromSource: 130, order: 2 },
            { city: "Krishnagiri", state: "Tamil Nadu", arrivalTime: "02:00", departureTime: "02:10", distanceFromSource: 220, order: 3 },
            { city: "Bangalore", state: "Karnataka", arrivalTime: "04:30", departureTime: "04:30", distanceFromSource: 350, order: 4 },
        ],
    },
    {
        busConfigIndex: 5,
        source: { city: "Chennai", state: "Tamil Nadu" },
        destination: { city: "Madurai", state: "Tamil Nadu" },
        distanceInKm: 460,
        farePerKm: 0.9,
        estimatedDurationInMinutes: 510,
        stops: [
            { city: "Chennai", state: "Tamil Nadu", arrivalTime: "20:00", departureTime: "20:00", distanceFromSource: 0, order: 1 },
            { city: "Villupuram", state: "Tamil Nadu", arrivalTime: "22:30", departureTime: "22:40", distanceFromSource: 150, order: 2 },
            { city: "Trichy", state: "Tamil Nadu", arrivalTime: "01:30", departureTime: "01:45", distanceFromSource: 320, order: 3 },
            { city: "Dindigul", state: "Tamil Nadu", arrivalTime: "03:15", departureTime: "03:25", distanceFromSource: 400, order: 4 },
            { city: "Madurai", state: "Tamil Nadu", arrivalTime: "04:30", departureTime: "04:30", distanceFromSource: 460, order: 5 },
        ],
    },
    {
        busConfigIndex: 2,
        source: { city: "Bangalore", state: "Karnataka" },
        destination: { city: "Hyderabad", state: "Telangana" },
        distanceInKm: 570,
        farePerKm: 2.2,
        estimatedDurationInMinutes: 540,
        stops: [
            { city: "Bangalore", state: "Karnataka", arrivalTime: "20:00", departureTime: "20:00", distanceFromSource: 0, order: 1 },
            { city: "Anantapur", state: "Andhra Pradesh", arrivalTime: "23:30", departureTime: "23:45", distanceFromSource: 210, order: 2 },
            { city: "Kurnool", state: "Andhra Pradesh", arrivalTime: "01:30", departureTime: "01:45", distanceFromSource: 350, order: 3 },
            { city: "Mahbubnagar", state: "Telangana", arrivalTime: "03:30", departureTime: "03:40", distanceFromSource: 460, order: 4 },
            { city: "Hyderabad", state: "Telangana", arrivalTime: "05:00", departureTime: "05:00", distanceFromSource: 570, order: 5 },
        ],
    },
    {
        busConfigIndex: 4,
        source: { city: "Hyderabad", state: "Telangana" },
        destination: { city: "Chennai", state: "Tamil Nadu" },
        distanceInKm: 630,
        farePerKm: 1.8,
        estimatedDurationInMinutes: 600,
        stops: [
            { city: "Hyderabad", state: "Telangana", arrivalTime: "19:00", departureTime: "19:00", distanceFromSource: 0, order: 1 },
            { city: "Vijayawada", state: "Andhra Pradesh", arrivalTime: "23:00", departureTime: "23:15", distanceFromSource: 270, order: 2 },
            { city: "Ongole", state: "Andhra Pradesh", arrivalTime: "01:30", departureTime: "01:40", distanceFromSource: 400, order: 3 },
            { city: "Nellore", state: "Andhra Pradesh", arrivalTime: "03:00", departureTime: "03:10", distanceFromSource: 490, order: 4 },
            { city: "Chennai", state: "Tamil Nadu", arrivalTime: "05:00", departureTime: "05:00", distanceFromSource: 630, order: 5 },
        ],
    }
];

const cityPoints = {
    "Chennai": [
        { name: "Koyambedu", landmark: "Omni Bus Stand" },
        { name: "Ashok Pillar", landmark: "Udhayam Theatre" },
        { name: "Guindy", landmark: "Kathipara Junction" },
        { name: "Tambaram", landmark: "Hindu Mission Hospital" },
        { name: "Perungalathur", landmark: "Bus Stop" }
    ],
    "Bangalore": [
        { name: "Madiwala", landmark: "Savoury Restaurant" },
        { name: "Silk Board", landmark: "Junction" },
        { name: "Electronic City", landmark: "Toll Gate" },
        { name: "Kalasi Palayam", landmark: "Bus Stand" }
    ],
    "Madurai": [
        { name: "Mattuthavani", landmark: "Omni Bus Stand" },
        { name: "Periyar Bus Stand", landmark: "City Center" },
        { name: "Arapalayam", landmark: "Bus Stand" }
    ],
    "Coimbatore": [
        { name: "Gandhipuram", landmark: "Omni Bus Stand" },
        { name: "Hopes College", landmark: "Bus Stop" },
        { name: "Singanallur", landmark: "Bus Stand" }
    ],
    "Trichy": [
        { name: "Chatiram Bus Stand", landmark: "Central Trichy" },
        { name: "Central Bus Stand", landmark: "Near Junction" }
    ],
    "Salem": [
        { name: "New Bus Stand", landmark: "Salem City" },
        { name: "AVR Roundana", landmark: "Bypass" }
    ],
    "Erode": [
        { name: "Erode Bus Stand", landmark: "Central Erode" },
        { name: "Bhavani Bypass", landmark: "Highway" }
    ],
    "Hyderabad": [
        { name: "Ameerpet", landmark: "Big Bazaar" },
        { name: "Kukatpally", landmark: "Metro Station" },
        { name: "Gachibowli", landmark: "Outer Ring Road" }
    ]
};

function getNextDates(count) {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= count; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SEED FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB connected");

        console.log("🗑️  Clearing existing bus data...");
        await Schedule.deleteMany({});
        await Route.deleteMany({});
        await Bus.deleteMany({});
        await User.deleteMany({ email: { $in: vendorUsers.map((v) => v.email) } });

        console.log("👤 Creating vendor users...");
        const createdVendors = [];
        for (const vendor of vendorUsers) {
            const hashedPassword = await bcrypt.hash(vendor.password, 10);
            const user = await User.create({ ...vendor, password: hashedPassword });
            createdVendors.push(user);
            console.log(`   ✅ Vendor: ${user.name} (${user.email})`);
        }

        console.log("\n🚌 Creating buses...");
        const createdBuses = [];
        for (const config of busConfigs) {
            const vendor = createdVendors[config.vendorIndex];
            const seatLayout = generateSeatLayout(config.seatLayoutType, config.totalSeats, config.baseFare);
            const bus = await Bus.create({
                operatorId: vendor._id, operatorName: vendor.name,
                busName: config.busName, busNumber: config.busNumber, registrationNumber: config.registrationNumber,
                busType: config.busType, seatLayoutType: config.seatLayoutType,
                totalSeats: config.totalSeats, lowerDeckSeats: config.lowerDeckSeats, upperDeckSeats: config.upperDeckSeats,
                sleeperSeats: config.sleeperSeats, seaterSeats: config.seaterSeats,
                isAC: config.isAC, isSleeper: config.isSleeper, isSeater: config.isSeater,
                amenities: config.amenities, isGPSAvailable: config.isGPSAvailable, isLiveTrackingEnabled: config.isLiveTrackingEnabled,
                seatLayout,
            });
            createdBuses.push(bus);
            console.log(`   ✅ ${bus.busName} (${bus.busNumber}) — ${seatLayout.length} seats`);
        }

        console.log("\n🛤️  Creating routes...");
        const createdRoutes = [];
        for (const config of routeConfigs) {
            const bus = createdBuses[config.busConfigIndex];
            const route = await Route.create({
                busId: bus._id, source: config.source, destination: config.destination,
                stops: config.stops, distanceInKm: config.distanceInKm,
                farePerKm: config.farePerKm, estimatedDurationInMinutes: config.estimatedDurationInMinutes,
            });
            createdRoutes.push({ route, busIndex: config.busConfigIndex });
            console.log(`   ✅ ${config.stops.map(s => s.city).join(" → ")} (${config.distanceInKm} km)`);
        }

        console.log("\n📅 Creating schedules...");
        const dates = getNextDates(5);
        let scheduleCount = 0;

        for (const { route, busIndex } of createdRoutes) {
            const bus = createdBuses[busIndex];
            const vendor = createdVendors[busConfigs[busIndex].vendorIndex];
            const baseFare = busConfigs[busIndex].baseFare;

            const seats = bus.seatLayout.map((seat) => ({
                seatNumber: seat.seatNumber, seatType: seat.seatType, deck: seat.deck, row: seat.row, column: seat.column,
                isSleeper: seat.isSleeper, fare: seat.fare || baseFare, status: "AVAILABLE",
                bookedBy: null, passengerName: null, passengerAge: null, passengerGender: null,
            }));

            const boardingPoints = [];
            const droppingPoints = [];

            // Add boarding points for all stops EXCEPT the last one
            for (let i = 0; i < route.stops.length - 1; i++) {
                const stop = route.stops[i];
                const points = cityPoints[stop.city] || [{ name: `${stop.city} Bus Stand`, landmark: `Main Stand` }];
                points.forEach((pt, index) => {
                    boardingPoints.push({
                        city: stop.city,
                        name: pt.name,
                        address: pt.landmark + ", " + stop.city,
                        time: stop.departureTime,
                        landmark: pt.landmark
                    });
                });
            }

            // Add dropping points for all stops EXCEPT the first one
            for (let i = 1; i < route.stops.length; i++) {
                const stop = route.stops[i];
                const points = cityPoints[stop.city] || [{ name: `${stop.city} Bus Stand`, landmark: `Main Stand` }];
                points.forEach((pt) => {
                    droppingPoints.push({
                        city: stop.city,
                        name: pt.name,
                        address: pt.landmark + ", " + stop.city,
                        time: stop.arrivalTime,
                        landmark: pt.landmark
                    });
                });
            }

            for (const date of dates) {
                const departureDateObj = new Date(date);
                const depTimeStr = route.stops[0].departureTime;
                
                // Calculate arrivalDate
                const [depHr, depMin] = depTimeStr.split(":").map(Number);
                const totalDepMins = depHr * 60 + depMin;
                const totalArrMins = totalDepMins + route.estimatedDurationInMinutes;
                
                const arrivalDateObj = new Date(departureDateObj);
                const daysAdded = Math.floor(totalArrMins / 1440);
                arrivalDateObj.setDate(arrivalDateObj.getDate() + daysAdded);

                await Schedule.create({
                    routeId: route._id,
                    busId: bus._id,
                    operatorId: vendor._id,
                    departureDate: departureDateObj,
                    arrivalDate: arrivalDateObj,
                    departureTime: depTimeStr,
                    arrivalTime: route.stops[route.stops.length - 1].arrivalTime,
                    baseFare,
                    availableSeats: seats.length,
                    seats,
                    boardingPoints,
                    droppingPoints,
                    cancellationPolicy: [
                        { hoursBeforeDeparture: 24, refundPercentage: 75 },
                        { hoursBeforeDeparture: 12, refundPercentage: 50 },
                        { hoursBeforeDeparture: 6, refundPercentage: 25 },
                        { hoursBeforeDeparture: 0, refundPercentage: 0 },
                    ],
                });
                scheduleCount++;
            }
        }
        console.log(`   ✅ Created ${scheduleCount} schedules across ${dates.length} days`);

        console.log("\n" + "═".repeat(60));
        console.log("🎉 SEED COMPLETE!");
        console.log("═".repeat(60));
        console.log(`   👤 Vendors:   ${createdVendors.length}`);
        console.log(`   🚌 Buses:     ${createdBuses.length}`);
        console.log(`   🛤️  Routes:    ${createdRoutes.length}`);
        console.log(`   📅 Schedules: ${scheduleCount}`);
        console.log("═".repeat(60));

    } catch (error) {
        console.error("❌ Seed failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 MongoDB disconnected");
        process.exit(0);
    }
}

seed();
