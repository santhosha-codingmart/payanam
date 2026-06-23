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
        // Lower deck + Upper deck, 3 columns (window, aisle, window)
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
        // Single deck, 4 columns
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
        // Luxury — 2 columns
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
        // 2+1_SEATER
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
    {
        name: "KPN Travels",
        email: "kpn@payanam.com",
        phoneNo: "+919000000001",
        password: "Vendor@123",
        role: "vendor",
        isEmailVerified: true,
        isPhoneVerified: true,
    },
    {
        name: "SRS Travels",
        email: "srs@payanam.com",
        phoneNo: "+919000000002",
        password: "Vendor@123",
        role: "vendor",
        isEmailVerified: true,
        isPhoneVerified: true,
    },
    {
        name: "Orange Travels",
        email: "orange@payanam.com",
        phoneNo: "+919000000003",
        password: "Vendor@123",
        role: "vendor",
        isEmailVerified: true,
        isPhoneVerified: true,
    },
];

// Bus configs — each vendor gets these buses
const busConfigs = [
    // ── KPN Buses ──
    {
        vendorIndex: 0,
        busName: "KPN Volvo Multi-Axle",
        busNumber: "TN01KPN001",
        registrationNumber: "TN01AB1234",
        busType: "AC_SLEEPER",
        seatLayoutType: "2+1_SLEEPER",
        totalSeats: 36,
        lowerDeckSeats: 18,
        upperDeckSeats: 18,
        sleeperSeats: 36,
        seaterSeats: 0,
        isAC: true,
        isSleeper: true,
        isSeater: false,
        amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "GPS Tracking"],
        isGPSAvailable: true,
        isLiveTrackingEnabled: true,
        baseFare: 800,
    },
    {
        vendorIndex: 0,
        busName: "KPN Deluxe Seater",
        busNumber: "TN01KPN002",
        registrationNumber: "TN01AB1235",
        busType: "AC_SEATER",
        seatLayoutType: "2+2_SEATER",
        totalSeats: 44,
        lowerDeckSeats: 44,
        upperDeckSeats: 0,
        sleeperSeats: 0,
        seaterSeats: 44,
        isAC: true,
        isSleeper: false,
        isSeater: true,
        amenities: ["Charging Point", "Water Bottle", "GPS Tracking"],
        isGPSAvailable: true,
        isLiveTrackingEnabled: false,
        baseFare: 450,
    },
    // ── SRS Buses ──
    {
        vendorIndex: 1,
        busName: "SRS Luxury Sleeper",
        busNumber: "KA01SRS001",
        registrationNumber: "KA01CD5678",
        busType: "LUXURY_SLEEPER",
        seatLayoutType: "1+1_SLEEPER",
        totalSeats: 24,
        lowerDeckSeats: 12,
        upperDeckSeats: 12,
        sleeperSeats: 24,
        seaterSeats: 0,
        isAC: true,
        isSleeper: true,
        isSeater: false,
        amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "Reading Light", "CCTV"],
        isGPSAvailable: true,
        isLiveTrackingEnabled: true,
        baseFare: 1200,
    },
    {
        vendorIndex: 1,
        busName: "SRS Semi-Sleeper",
        busNumber: "KA01SRS002",
        registrationNumber: "KA01CD5679",
        busType: "SEMI_SLEEPER",
        seatLayoutType: "2+1_SEATER",
        totalSeats: 36,
        lowerDeckSeats: 36,
        upperDeckSeats: 0,
        sleeperSeats: 0,
        seaterSeats: 36,
        isAC: true,
        isSleeper: false,
        isSeater: true,
        amenities: ["Charging Point", "Water Bottle"],
        isGPSAvailable: false,
        isLiveTrackingEnabled: false,
        baseFare: 550,
    },
    // ── Orange Buses ──
    {
        vendorIndex: 2,
        busName: "Orange Volvo 9600",
        busNumber: "AP01ORG001",
        registrationNumber: "AP01EF9012",
        busType: "VOLVO_AC",
        seatLayoutType: "2+1_SLEEPER",
        totalSeats: 30,
        lowerDeckSeats: 15,
        upperDeckSeats: 15,
        sleeperSeats: 30,
        seaterSeats: 0,
        isAC: true,
        isSleeper: true,
        isSeater: false,
        amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "Reading Light", "GPS Tracking", "CCTV"],
        isGPSAvailable: true,
        isLiveTrackingEnabled: true,
        baseFare: 900,
    },
    {
        vendorIndex: 2,
        busName: "Orange Non-AC Seater",
        busNumber: "AP01ORG002",
        registrationNumber: "AP01EF9013",
        busType: "NON_AC_SEATER",
        seatLayoutType: "2+2_SEATER",
        totalSeats: 48,
        lowerDeckSeats: 48,
        upperDeckSeats: 0,
        sleeperSeats: 0,
        seaterSeats: 48,
        isAC: false,
        isSleeper: false,
        isSeater: true,
        amenities: ["Emergency Exit"],
        isGPSAvailable: false,
        isLiveTrackingEnabled: false,
        baseFare: 300,
    },
];

// Route configs with intermediate stops
const routeConfigs = [
    // ── Route 1: Chennai → Bangalore (via Vellore, Krishnagiri) ──
    {
        busConfigIndex: 0, // KPN Volvo
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
    // ── Route 2: Chennai → Bangalore (via Kanchipuram, Vellore) — different bus ──
    {
        busConfigIndex: 1, // KPN Seater
        source: { city: "Chennai", state: "Tamil Nadu" },
        destination: { city: "Bangalore", state: "Karnataka" },
        distanceInKm: 360,
        farePerKm: 1.5,
        estimatedDurationInMinutes: 420,
        stops: [
            { city: "Chennai", state: "Tamil Nadu", arrivalTime: "21:00", departureTime: "21:00", distanceFromSource: 0, order: 1 },
            { city: "Kanchipuram", state: "Tamil Nadu", arrivalTime: "22:15", departureTime: "22:25", distanceFromSource: 70, order: 2 },
            { city: "Vellore", state: "Tamil Nadu", arrivalTime: "00:00", departureTime: "00:10", distanceFromSource: 140, order: 3 },
            { city: "Bangalore", state: "Karnataka", arrivalTime: "04:00", departureTime: "04:00", distanceFromSource: 360, order: 4 },
        ],
    },
    // ── Route 3: Bangalore → Hyderabad (via Anantapur, Kurnool) ──
    {
        busConfigIndex: 2, // SRS Luxury
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
    // ── Route 4: Bangalore → Hyderabad (budget — different bus) ──
    {
        busConfigIndex: 3, // SRS Semi-Sleeper
        source: { city: "Bangalore", state: "Karnataka" },
        destination: { city: "Hyderabad", state: "Telangana" },
        distanceInKm: 570,
        farePerKm: 1.2,
        estimatedDurationInMinutes: 600,
        stops: [
            { city: "Bangalore", state: "Karnataka", arrivalTime: "19:00", departureTime: "19:00", distanceFromSource: 0, order: 1 },
            { city: "Anantapur", state: "Andhra Pradesh", arrivalTime: "22:30", departureTime: "22:45", distanceFromSource: 210, order: 2 },
            { city: "Kurnool", state: "Andhra Pradesh", arrivalTime: "01:00", departureTime: "01:15", distanceFromSource: 350, order: 3 },
            { city: "Hyderabad", state: "Telangana", arrivalTime: "05:00", departureTime: "05:00", distanceFromSource: 570, order: 4 },
        ],
    },
    // ── Route 5: Hyderabad → Chennai (via Vijayawada, Ongole, Nellore) ──
    {
        busConfigIndex: 4, // Orange Volvo
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
    },
    // ── Route 6: Chennai → Madurai (via Villupuram, Trichy) ──
    {
        busConfigIndex: 5, // Orange Non-AC
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
];

// Schedule dates — create schedules for next 5 days
function getNextDates(count) {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= count; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]); // "YYYY-MM-DD"
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

        // ── Clear existing data ──
        console.log("🗑️  Clearing existing bus data...");
        await Schedule.deleteMany({});
        await Route.deleteMany({});
        await Bus.deleteMany({});
        // Only delete vendor seed users (not real users)
        await User.deleteMany({ email: { $in: vendorUsers.map((v) => v.email) } });

        // ── 1. Create vendor users ──
        console.log("👤 Creating vendor users...");
        const createdVendors = [];
        for (const vendor of vendorUsers) {
            const hashedPassword = await bcrypt.hash(vendor.password, 10);
            const user = await User.create({ ...vendor, password: hashedPassword });
            createdVendors.push(user);
            console.log(`   ✅ Vendor: ${user.name} (${user.email})`);
        }

        // ── 2. Create buses ──
        console.log("\n🚌 Creating buses...");
        const createdBuses = [];
        for (const config of busConfigs) {
            const vendor = createdVendors[config.vendorIndex];
            const seatLayout = generateSeatLayout(config.seatLayoutType, config.totalSeats, config.baseFare);

            const bus = await Bus.create({
                operatorId: vendor._id,
                operatorName: vendor.name,
                busName: config.busName,
                busNumber: config.busNumber,
                registrationNumber: config.registrationNumber,
                busType: config.busType,
                seatLayoutType: config.seatLayoutType,
                totalSeats: config.totalSeats,
                lowerDeckSeats: config.lowerDeckSeats,
                upperDeckSeats: config.upperDeckSeats,
                sleeperSeats: config.sleeperSeats,
                seaterSeats: config.seaterSeats,
                isAC: config.isAC,
                isSleeper: config.isSleeper,
                isSeater: config.isSeater,
                amenities: config.amenities,
                isGPSAvailable: config.isGPSAvailable,
                isLiveTrackingEnabled: config.isLiveTrackingEnabled,
                seatLayout,
            });

            createdBuses.push(bus);
            console.log(`   ✅ ${bus.busName} (${bus.busNumber}) — ${seatLayout.length} seats`);
        }

        // ── 3. Create routes ──
        console.log("\n🛤️  Creating routes...");
        const createdRoutes = [];
        for (const config of routeConfigs) {
            const bus = createdBuses[config.busConfigIndex];

            const route = await Route.create({
                busId: bus._id,
                source: config.source,
                destination: config.destination,
                stops: config.stops,
                distanceInKm: config.distanceInKm,
                farePerKm: config.farePerKm,
                estimatedDurationInMinutes: config.estimatedDurationInMinutes,
            });

            createdRoutes.push({ route, busIndex: config.busConfigIndex });
            const stopNames = config.stops.map((s) => s.city).join(" → ");
            console.log(`   ✅ ${stopNames} (${config.distanceInKm} km, ₹${config.farePerKm}/km)`);
        }

        // ── 4. Create schedules (trips) for next 5 days ──
        console.log("\n📅 Creating schedules...");
        const dates = getNextDates(5);
        let scheduleCount = 0;

        for (const { route, busIndex } of createdRoutes) {
            const bus = createdBuses[busIndex];
            const vendor = createdVendors[busConfigs[busIndex].vendorIndex];
            const baseFare = busConfigs[busIndex].baseFare;

            // Build seats from bus layout
            const seats = bus.seatLayout.map((seat) => ({
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                deck: seat.deck,
                row: seat.row,
                column: seat.column,
                isSleeper: seat.isSleeper,
                fare: seat.fare || baseFare,
                status: "AVAILABLE",
                bookedBy: null,
                passengerName: null,
                passengerAge: null,
                passengerGender: null,
            }));

            // Boarding & dropping points from the route stops
            const boardingPoints = route.stops.slice(0, -1).map((stop) => ({
                name: `${stop.city} Bus Stand`,
                address: `Main Bus Stand, ${stop.city}`,
                time: stop.departureTime,
                landmark: `Near ${stop.city} Railway Station`,
            }));

            const droppingPoints = route.stops.slice(1).map((stop) => ({
                name: `${stop.city} Bus Stand`,
                address: `Main Bus Stand, ${stop.city}`,
                time: stop.arrivalTime,
                landmark: `Near ${stop.city} Railway Station`,
            }));

            for (const date of dates) {
                await Schedule.create({
                    routeId: route._id,
                    busId: bus._id,
                    operatorId: vendor._id,
                    departureDate: new Date(date),
                    departureTime: route.stops[0].departureTime,
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

        // ── Summary ──
        console.log("\n" + "═".repeat(60));
        console.log("🎉 SEED COMPLETE!");
        console.log("═".repeat(60));
        console.log(`   👤 Vendors:   ${createdVendors.length}`);
        console.log(`   🚌 Buses:     ${createdBuses.length}`);
        console.log(`   🛤️  Routes:    ${createdRoutes.length}`);
        console.log(`   📅 Schedules: ${scheduleCount}`);
        console.log("═".repeat(60));
        console.log("\n📌 Vendor login credentials (all passwords: Vendor@123):");
        for (const v of createdVendors) {
            console.log(`   ${v.name}: ${v.email}`);
        }
        console.log("\n📌 Sample search queries to test:");
        console.log(`   GET /api/v1/buses/search?from=Chennai&to=Bangalore&date=${dates[0]}`);
        console.log(`   GET /api/v1/buses/search?from=Vellore&to=Bangalore&date=${dates[0]}  ← intermediate stop!`);
        console.log(`   GET /api/v1/buses/search?from=Bangalore&to=Hyderabad&date=${dates[0]}`);
        console.log(`   GET /api/v1/buses/search?from=Anantapur&to=Hyderabad&date=${dates[0]}  ← intermediate stop!`);
        console.log(`   GET /api/v1/buses/search?from=Hyderabad&to=Chennai&date=${dates[0]}`);
        console.log(`   GET /api/v1/buses/search?from=Chennai&to=Madurai&date=${dates[0]}`);
        console.log(`   GET /api/v1/buses/search?from=Villupuram&to=Trichy&date=${dates[0]}  ← intermediate stop!`);

    } catch (error) {
        console.error("❌ Seed failed:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\n🔌 MongoDB disconnected");
        process.exit(0);
    }
}

seed();
