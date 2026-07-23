import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../modules/users/models/user.model.js";
import { Bus } from "../modules/bus/models/bus.model.js";
import { Route } from "../modules/bus/models/route.model.js";
import { Schedule } from "../modules/bus/models/schedule.model.js";
import bcrypt from "bcrypt";

dotenv.config();

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
        const seatType =
          col === 1 || col === 4 ? "window" : col === 2 ? "aisle" : "middle";
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
const vendorUsers = [
  {
    name: "A1 Travels",
    email: "a1@payanam.com",
    phoneNo: "+919000000001",
    password: "Vendor@123",
    role: "vendor",
    isEmailVerified: true,
    isPhoneVerified: true,
  },
  {
    name: "Krish Travels",
    email: "krish@payanam.com",
    phoneNo: "+919000000002",
    password: "Vendor@123",
    role: "vendor",
    isEmailVerified: true,
    isPhoneVerified: true,
  },
  {
    name: "Rathimeena",
    email: "rathimeena@payanam.com",
    phoneNo: "+919000000003",
    password: "Vendor@123",
    role: "vendor",
    isEmailVerified: true,
    isPhoneVerified: true,
  },
  {
    name: "SRM Travels",
    email: "srm@payanam.com",
    phoneNo: "+919000000004",
    password: "Vendor@123",
    role: "vendor",
    isEmailVerified: true,
    isPhoneVerified: true,
  },
  {
    name: "YBM Travels",
    email: "ybm@payanam.com",
    phoneNo: "+919000000005",
    password: "Vendor@123",
    role: "vendor",
    isEmailVerified: true,
    isPhoneVerified: true,
  },
];
const busConfigs = [
  {
    vendorIndex: 0,
    busName: "A1 AC Sleeper",
    busNumber: "TN01A1001",
    registrationNumber: "TN01AB1111",
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
    amenities: ["WiFi", "Charging Point", "Blanket", "Water Bottle"],
    isGPSAvailable: true,
    isLiveTrackingEnabled: true,
    baseFare: 900,
  },
  {
    vendorIndex: 1,
    busName: "Krish Deluxe Seater",
    busNumber: "TN02K002",
    registrationNumber: "TN02CD2222",
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
    baseFare: 500,
  },
  {
    vendorIndex: 2,
    busName: "Rathimeena Luxury",
    busNumber: "TN03R003",
    registrationNumber: "TN03EF3333",
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
    amenities: ["WiFi", "Charging Point", "Blanket", "Reading Light", "CCTV"],
    isGPSAvailable: true,
    isLiveTrackingEnabled: true,
    baseFare: 1100,
  },
  {
    vendorIndex: 3,
    busName: "SRM Semi-Sleeper",
    busNumber: "TN04S004",
    registrationNumber: "TN04GH4444",
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
    baseFare: 600,
  },
  {
    vendorIndex: 4,
    busName: "YBM Volvo 9600",
    busNumber: "TN05Y005",
    registrationNumber: "TN05IJ5555",
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
    amenities: [
      "WiFi",
      "Charging Point",
      "Blanket",
      "Water Bottle",
      "GPS Tracking",
    ],
    isGPSAvailable: true,
    isLiveTrackingEnabled: true,
    baseFare: 1000,
  },
];
const chennaiCoimbatoreStops = [
  {
    city: "Chennai",
    state: "Tamil Nadu",
    arrivalTime: "00:00",
    departureTime: "00:00",
    distanceFromSource: 0,
    order: 1,
  },
  {
    city: "Salem",
    state: "Tamil Nadu",
    arrivalTime: "05:00",
    departureTime: "05:10",
    distanceFromSource: 340,
    order: 2,
  },
  {
    city: "Erode",
    state: "Tamil Nadu",
    arrivalTime: "06:30",
    departureTime: "06:40",
    distanceFromSource: 400,
    order: 3,
  },
  {
    city: "Tiruppur",
    state: "Tamil Nadu",
    arrivalTime: "07:30",
    departureTime: "07:40",
    distanceFromSource: 450,
    order: 4,
  },
  {
    city: "Coimbatore",
    state: "Tamil Nadu",
    arrivalTime: "09:00",
    departureTime: "09:00",
    distanceFromSource: 510,
    order: 5,
  },
];
const chennaiKanyakumariStops = [
  {
    city: "Chennai",
    state: "Tamil Nadu",
    arrivalTime: "00:00",
    departureTime: "00:00",
    distanceFromSource: 0,
    order: 1,
  },
  {
    city: "Villupuram",
    state: "Tamil Nadu",
    arrivalTime: "02:30",
    departureTime: "02:40",
    distanceFromSource: 150,
    order: 2,
  },
  {
    city: "Trichy",
    state: "Tamil Nadu",
    arrivalTime: "05:00",
    departureTime: "05:15",
    distanceFromSource: 330,
    order: 3,
  },
  {
    city: "Madurai",
    state: "Tamil Nadu",
    arrivalTime: "07:30",
    departureTime: "07:45",
    distanceFromSource: 460,
    order: 4,
  },
  {
    city: "Kanyakumari",
    state: "Tamil Nadu",
    arrivalTime: "12:00",
    departureTime: "12:00",
    distanceFromSource: 700,
    order: 5,
  },
];
const chennaiTrichyStops = [
  {
    city: "Chennai",
    state: "Tamil Nadu",
    arrivalTime: "00:00",
    departureTime: "00:00",
    distanceFromSource: 0,
    order: 1,
  },
  {
    city: "Villupuram",
    state: "Tamil Nadu",
    arrivalTime: "02:30",
    departureTime: "02:40",
    distanceFromSource: 150,
    order: 2,
  },
  {
    city: "Trichy",
    state: "Tamil Nadu",
    arrivalTime: "06:00",
    departureTime: "06:00",
    distanceFromSource: 330,
    order: 3,
  },
];
const coimbatoreKanyakumariStops = [
  {
    city: "Coimbatore",
    state: "Tamil Nadu",
    arrivalTime: "00:00",
    departureTime: "00:00",
    distanceFromSource: 0,
    order: 1,
  },
  {
    city: "Dharapuram",
    state: "Tamil Nadu",
    arrivalTime: "01:30",
    departureTime: "01:40",
    distanceFromSource: 80,
    order: 2,
  },
  {
    city: "Madurai",
    state: "Tamil Nadu",
    arrivalTime: "04:30",
    departureTime: "04:45",
    distanceFromSource: 220,
    order: 3,
  },
  {
    city: "Tirunelveli",
    state: "Tamil Nadu",
    arrivalTime: "07:00",
    departureTime: "07:15",
    distanceFromSource: 370,
    order: 4,
  },
  {
    city: "Kanyakumari",
    state: "Tamil Nadu",
    arrivalTime: "08:30",
    departureTime: "08:30",
    distanceFromSource: 450,
    order: 5,
  },
];
const routeConfigs = [
  {
    busConfigIndex: 0,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    distanceInKm: 510,
    farePerKm: 2.0,
    estimatedDurationInMinutes: 540,
    stops: chennaiCoimbatoreStops,
    departureTimes: ["06:00", "10:00", "18:00", "21:00", "22:30"],
  },
  {
    busConfigIndex: 1,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    distanceInKm: 510,
    farePerKm: 1.5,
    estimatedDurationInMinutes: 540,
    stops: chennaiCoimbatoreStops,
    departureTimes: ["07:00", "11:00", "19:00", "21:30", "23:00"],
  },
  {
    busConfigIndex: 2,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    distanceInKm: 510,
    farePerKm: 2.5,
    estimatedDurationInMinutes: 540,
    stops: chennaiCoimbatoreStops,
    departureTimes: ["08:00", "12:00", "20:00", "22:00"],
  },
  {
    busConfigIndex: 3,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    distanceInKm: 510,
    farePerKm: 1.8,
    estimatedDurationInMinutes: 540,
    stops: chennaiCoimbatoreStops,
    departureTimes: ["09:00", "13:00", "20:30", "23:30"],
  },
  {
    busConfigIndex: 4,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    distanceInKm: 510,
    farePerKm: 2.2,
    estimatedDurationInMinutes: 540,
    stops: chennaiCoimbatoreStops,
    departureTimes: ["14:00", "16:00", "19:30", "22:45"],
  },
  {
    busConfigIndex: 0,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 700,
    farePerKm: 2.0,
    estimatedDurationInMinutes: 720,
    stops: chennaiKanyakumariStops,
    departureTimes: ["16:00", "18:00", "20:00", "22:00"],
  },
  {
    busConfigIndex: 1,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 700,
    farePerKm: 1.5,
    estimatedDurationInMinutes: 720,
    stops: chennaiKanyakumariStops,
    departureTimes: ["17:00", "19:00", "21:00", "22:30"],
  },
  {
    busConfigIndex: 2,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 700,
    farePerKm: 2.5,
    estimatedDurationInMinutes: 720,
    stops: chennaiKanyakumariStops,
    departureTimes: ["15:30", "18:30", "20:30", "21:30"],
  },
  {
    busConfigIndex: 3,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 700,
    farePerKm: 1.8,
    estimatedDurationInMinutes: 720,
    stops: chennaiKanyakumariStops,
    departureTimes: ["16:30", "19:30", "21:15", "23:00"],
  },
  {
    busConfigIndex: 4,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 700,
    farePerKm: 2.2,
    estimatedDurationInMinutes: 720,
    stops: chennaiKanyakumariStops,
    departureTimes: ["17:30", "18:45", "20:45", "22:45"],
  },
  {
    busConfigIndex: 0,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Trichy",
      state: "Tamil Nadu",
    },
    distanceInKm: 330,
    farePerKm: 2.0,
    estimatedDurationInMinutes: 360,
    stops: chennaiTrichyStops,
    departureTimes: ["05:00", "09:00", "13:00", "17:00", "21:00"],
  },
  {
    busConfigIndex: 1,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Trichy",
      state: "Tamil Nadu",
    },
    distanceInKm: 330,
    farePerKm: 1.5,
    estimatedDurationInMinutes: 360,
    stops: chennaiTrichyStops,
    departureTimes: ["06:00", "10:00", "14:00", "18:00", "22:00"],
  },
  {
    busConfigIndex: 2,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Trichy",
      state: "Tamil Nadu",
    },
    distanceInKm: 330,
    farePerKm: 2.5,
    estimatedDurationInMinutes: 360,
    stops: chennaiTrichyStops,
    departureTimes: ["07:00", "11:00", "15:00", "19:00", "23:00"],
  },
  {
    busConfigIndex: 3,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Trichy",
      state: "Tamil Nadu",
    },
    distanceInKm: 330,
    farePerKm: 1.8,
    estimatedDurationInMinutes: 360,
    stops: chennaiTrichyStops,
    departureTimes: ["08:00", "12:00", "16:00", "20:00"],
  },
  {
    busConfigIndex: 4,
    source: {
      city: "Chennai",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Trichy",
      state: "Tamil Nadu",
    },
    distanceInKm: 330,
    farePerKm: 2.2,
    estimatedDurationInMinutes: 360,
    stops: chennaiTrichyStops,
    departureTimes: ["06:30", "10:30", "14:30", "18:30"],
  },
  {
    busConfigIndex: 0,
    source: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 450,
    farePerKm: 2.0,
    estimatedDurationInMinutes: 510,
    stops: coimbatoreKanyakumariStops,
    departureTimes: ["18:00", "20:00", "22:00", "23:00"],
  },
  {
    busConfigIndex: 1,
    source: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 450,
    farePerKm: 1.5,
    estimatedDurationInMinutes: 510,
    stops: coimbatoreKanyakumariStops,
    departureTimes: ["19:00", "21:00", "22:30"],
  },
  {
    busConfigIndex: 2,
    source: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 450,
    farePerKm: 2.5,
    estimatedDurationInMinutes: 510,
    stops: coimbatoreKanyakumariStops,
    departureTimes: ["17:30", "19:30", "21:30", "23:15"],
  },
  {
    busConfigIndex: 3,
    source: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 450,
    farePerKm: 1.8,
    estimatedDurationInMinutes: 510,
    stops: coimbatoreKanyakumariStops,
    departureTimes: ["18:30", "20:30", "22:15", "23:45"],
  },
  {
    busConfigIndex: 4,
    source: {
      city: "Coimbatore",
      state: "Tamil Nadu",
    },
    destination: {
      city: "Kanyakumari",
      state: "Tamil Nadu",
    },
    distanceInKm: 450,
    farePerKm: 2.2,
    estimatedDurationInMinutes: 510,
    stops: coimbatoreKanyakumariStops,
    departureTimes: ["19:15", "20:45", "21:45", "22:45"],
  },
];
const cityPoints = {
  Chennai: [
    {
      name: "Koyambedu",
      landmark: "Omni Bus Stand",
    },
    {
      name: "Ashok Pillar",
      landmark: "Udhayam Theatre",
    },
    {
      name: "Guindy",
      landmark: "Kathipara Junction",
    },
    {
      name: "Tambaram",
      landmark: "Hindu Mission Hospital",
    },
    {
      name: "Perungalathur",
      landmark: "Bus Stop",
    },
  ],
  Bangalore: [
    {
      name: "Madiwala",
      landmark: "Savoury Restaurant",
    },
    {
      name: "Silk Board",
      landmark: "Junction",
    },
    {
      name: "Electronic City",
      landmark: "Toll Gate",
    },
    {
      name: "Kalasi Palayam",
      landmark: "Bus Stand",
    },
  ],
  Madurai: [
    {
      name: "Mattuthavani",
      landmark: "Omni Bus Stand",
    },
    {
      name: "Periyar Bus Stand",
      landmark: "City Center",
    },
    {
      name: "Arapalayam",
      landmark: "Bus Stand",
    },
  ],
  Coimbatore: [
    {
      name: "Gandhipuram",
      landmark: "Omni Bus Stand",
    },
    {
      name: "Hopes College",
      landmark: "Bus Stop",
    },
    {
      name: "Singanallur",
      landmark: "Bus Stand",
    },
  ],
  Trichy: [
    {
      name: "Chatiram Bus Stand",
      landmark: "Central Trichy",
    },
    {
      name: "Central Bus Stand",
      landmark: "Near Junction",
    },
  ],
  Salem: [
    {
      name: "New Bus Stand",
      landmark: "Salem City",
    },
    {
      name: "AVR Roundana",
      landmark: "Bypass",
    },
  ],
  Erode: [
    {
      name: "Erode Bus Stand",
      landmark: "Central Erode",
    },
    {
      name: "Bhavani Bypass",
      landmark: "Highway",
    },
  ],
  Hyderabad: [
    {
      name: "Ameerpet",
      landmark: "Big Bazaar",
    },
    {
      name: "Kukatpally",
      landmark: "Metro Station",
    },
    {
      name: "Gachibowli",
      landmark: "Outer Ring Road",
    },
  ],
  Kanyakumari: [
    {
      name: "Kanyakumari Bus Stand",
      landmark: "Town Center",
    },
    {
      name: "Kovalam Junction",
      landmark: "Near Beach",
    },
  ],
  Sivagangai: [
    {
      name: "Sivagangai Bus Stand",
      landmark: "Main Bus Stand",
    },
    {
      name: "Anna Salai Stop",
      landmark: "Town Center",
    },
  ],
  Villupuram: [
    {
      name: "Villupuram Bus Stand",
      landmark: "Junction",
    },
  ],
  Dindigul: [
    {
      name: "Dindigul Bus Stand",
      landmark: "Central Dindigul",
    },
  ],
  Tiruppur: [
    {
      name: "Tiruppur Old Bus Stand",
      landmark: "City Center",
    },
  ],
  Dharapuram: [
    {
      name: "Dharapuram Bus Stand",
      landmark: "Main Stand",
    },
  ],
  Tirunelveli: [
    {
      name: "Tirunelveli New Bus Stand",
      landmark: "Vannarpettai",
    },
    {
      name: "Junction",
      landmark: "Railway Station",
    },
  ],
};

function getDateRange() {
  const dates = [];
  const start = new Date("2026-07-23");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
    console.log("🗑️  Clearing existing bus data...");
    await Schedule.deleteMany({});
    await Route.deleteMany({});
    await Bus.deleteMany({});
    await User.deleteMany({
      role: "vendor",
    });
    console.log("👤 Creating vendor users...");
    const createdVendors = [];
    for (const vendor of vendorUsers) {
      const hashedPassword = await bcrypt.hash(vendor.password, 10);
      const user = await User.create({
        ...vendor,
        password: hashedPassword,
      });
      createdVendors.push(user);
      console.log(`   ✅ Vendor: ${user.name} (${user.email})`);
    }
    console.log("\n🚌 Creating buses...");
    const createdBuses = [];
    for (const config of busConfigs) {
      const vendor = createdVendors[config.vendorIndex];
      const seatLayout = generateSeatLayout(
        config.seatLayoutType,
        config.totalSeats,
        config.baseFare,
      );
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
      console.log(
        `   ✅ ${bus.busName} (${bus.busNumber}) — ${seatLayout.length} seats`,
      );
    }
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
      createdRoutes.push({
        route,
        busIndex: config.busConfigIndex,
        departureTimes: config.departureTimes,
      });
      console.log(
        `   ✅ ${config.stops.map((s) => s.city).join(" → ")} (${config.distanceInKm} km)`,
      );
    }
    console.log("\n📅 Creating schedules...");
    const dates = getDateRange();
    let scheduleCount = 0;
    for (const { route, busIndex, departureTimes } of createdRoutes) {
      const bus = createdBuses[busIndex];
      const vendor = createdVendors[busConfigs[busIndex].vendorIndex];
      const baseFare = busConfigs[busIndex].baseFare;
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
      const computeStopTime = (
        depTimeStr,
        stop,
        totalDistanceKm,
        totalDurationMins,
      ) => {
        const [depHr, depMin] = depTimeStr.split(":").map(Number);
        const depTotalMins = depHr * 60 + depMin;
        const ratio =
          totalDistanceKm > 0 ? stop.distanceFromSource / totalDistanceKm : 0;
        const offsetMins = Math.round(ratio * totalDurationMins);
        const stopTotalMins = (depTotalMins + offsetMins) % 1440;
        const hr = Math.floor(stopTotalMins / 60)
          .toString()
          .padStart(2, "0");
        const min = (stopTotalMins % 60).toString().padStart(2, "0");
        return `${hr}:${min}`;
      };
      const timeSlots =
        departureTimes && departureTimes.length > 0
          ? departureTimes
          : [route.stops[0].departureTime];
      for (const date of dates) {
        for (const depTimeStr of timeSlots) {
          const departureDateObj = new Date(date);
          const [depHr, depMin] = depTimeStr.split(":").map(Number);
          const totalDepMins = depHr * 60 + depMin;
          const totalArrMins = totalDepMins + route.estimatedDurationInMinutes;
          const arrivalDateObj = new Date(departureDateObj);
          const daysAdded = Math.floor(totalArrMins / 1440);
          arrivalDateObj.setDate(arrivalDateObj.getDate() + daysAdded);
          const arrMinsInDay = totalArrMins % 1440;
          const arrHr = Math.floor(arrMinsInDay / 60)
            .toString()
            .padStart(2, "0");
          const arrMin = (arrMinsInDay % 60).toString().padStart(2, "0");
          const arrivalTimeStr = `${arrHr}:${arrMin}`;
          const scheduleBoardingPoints = [];
          const scheduleDroppingPoints = [];
          for (let i = 0; i < route.stops.length - 1; i++) {
            const stop = route.stops[i];
            const realTime = computeStopTime(
              depTimeStr,
              stop,
              route.distanceInKm,
              route.estimatedDurationInMinutes,
            );
            const points = cityPoints[stop.city] || [
              {
                name: `${stop.city} Bus Stand`,
                landmark: `Main Stand`,
              },
            ];
            points.forEach((pt) => {
              scheduleBoardingPoints.push({
                city: stop.city,
                name: pt.name,
                address: pt.landmark + ", " + stop.city,
                time: realTime,
                landmark: pt.landmark,
              });
            });
          }
          for (let i = 1; i < route.stops.length; i++) {
            const stop = route.stops[i];
            const realTime = computeStopTime(
              depTimeStr,
              stop,
              route.distanceInKm,
              route.estimatedDurationInMinutes,
            );
            const points = cityPoints[stop.city] || [
              {
                name: `${stop.city} Bus Stand`,
                landmark: `Main Stand`,
              },
            ];
            points.forEach((pt) => {
              scheduleDroppingPoints.push({
                city: stop.city,
                name: pt.name,
                address: pt.landmark + ", " + stop.city,
                time: realTime,
                landmark: pt.landmark,
              });
            });
          }
          await Schedule.create({
            routeId: route._id,
            busId: bus._id,
            operatorId: vendor._id,
            departureDate: departureDateObj,
            arrivalDate: arrivalDateObj,
            departureTime: depTimeStr,
            arrivalTime: arrivalTimeStr,
            baseFare,
            availableSeats: seats.length,
            seats,
            boardingPoints: scheduleBoardingPoints,
            droppingPoints: scheduleDroppingPoints,
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
          scheduleCount++;
        }
      }
    }
    console.log(
      `   ✅ Created ${scheduleCount} schedules across ${dates.length} days`,
    );
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
