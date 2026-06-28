import mongoose from "mongoose";
import dotenv from "dotenv";
import { Schedule } from "../modules/bus/models/schedule.model.js";

dotenv.config();

async function testSeats() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  // Find one schedule with populated bus & route
  const schedule = await Schedule.findOne()
    .populate("busId", "busName busType busNumber seatLayoutType amenities averageRating")
    .populate("routeId", "source destination")
    .lean();

  if (!schedule) {
    console.log("❌ No schedules found. Run the seed first!");
    await mongoose.disconnect();
    return;
  }

  console.log("═".repeat(70));
  console.log("📋 Schedule ID :", schedule._id);
  console.log("═".repeat(70));
  console.log("");

  // ── Bus info ──
  console.log("── Bus Info ──");
  console.log(JSON.stringify(schedule.busId, null, 2));
  console.log("");

  // ── Route info ──
  console.log("── Route ──");
  console.log(JSON.stringify(schedule.routeId, null, 2));
  console.log("");

  // ── Journey ──
  console.log(`── Journey ──`);
  console.log(`   Departure: ${schedule.departureDate} ${schedule.departureTime}`);
  console.log(`   Arrival:   ${schedule.arrivalDate} ${schedule.arrivalTime}`);
  console.log(`   Base Fare: ₹${schedule.baseFare}`);
  console.log(`   Seats:     ${schedule.availableSeats} available / ${schedule.seats.length} total`);
  console.log("");

  // ── Seat Layout Sample (first 6 seats) ──
  console.log("── Seat Layout (first 6 seats) ──");
  const sampleSeats = schedule.seats.slice(0, 6).map(s => ({
    seatNumber: s.seatNumber,
    seatType: s.seatType,
    deck: s.deck,
    row: s.row,
    column: s.column,
    isSleeper: s.isSleeper,
    fare: s.fare,
    status: s.status,
  }));
  console.table(sampleSeats);

  // ── Boarding / Dropping points ──
  console.log(`\n── Boarding Points (${schedule.boardingPoints.length}) ──`);
  schedule.boardingPoints.slice(0, 3).forEach(bp =>
    console.log(`   • ${bp.name} - ${bp.city} (${bp.time}) | ${bp.address} | ${bp.landmark}`)
  );
  console.log(`\n── Dropping Points (${schedule.droppingPoints.length}) ──`);
  schedule.droppingPoints.slice(0, 3).forEach(dp =>
    console.log(`   • ${dp.name} - ${dp.city} (${dp.time}) | ${dp.address} | ${dp.landmark}`)
  );

  // ── Check which fields exist in seats ──
  const firstSeat = schedule.seats[0];
  console.log("\n── Full fields available per seat ──");
  console.log(Object.keys(firstSeat));

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected");
}

testSeats().catch(console.error);
