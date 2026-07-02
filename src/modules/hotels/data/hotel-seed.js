import mongoose from "mongoose";
import dotenv from "dotenv";
import Hotel from "../models/hotel.model.js";
import Room from "../models/room.model.js";
import User from "../../users/models/user.model.js";
import { bulkUpsertCities } from "../../places/services/city.service.js";
import connectDB from "../../../config/db.js";

dotenv.config();

const hotelsData = [
    {
        name: "Taj Coromandel",
        description: "Experience luxury in the heart of Chennai with unparalleled service and amenities.",
        address: "37, Mahatma Gandhi Rd, Nungambakkam",
        city: "Chennai",
        state: "Tamil Nadu",
        starRating: 5,
        amenities: ["Free WiFi", "Swimming Pool", "Spa", "Gym", "Restaurant", "Bar"],
        checkInTime: "14:00",
        checkOutTime: "12:00",
        images: ["https://example.com/taj1.jpg"],
    },
    {
        name: "ITC Grand Chola",
        description: "A luxury collection hotel, paying tribute to the Chola dynasty.",
        address: "63, Mount Road, Guindy",
        city: "Chennai",
        state: "Tamil Nadu",
        starRating: 5,
        amenities: ["Free WiFi", "Multiple Pools", "Luxury Spa", "Fitness Center", "Fine Dining"],
        checkInTime: "15:00",
        checkOutTime: "12:00",
        images: ["https://example.com/itc1.jpg"],
    },
    {
        name: "The Leela Palace",
        description: "Sea-facing luxury hotel combining modern amenities with traditional Indian architecture.",
        address: "Adyar Seaface, MRC Nagar",
        city: "Chennai",
        state: "Tamil Nadu",
        starRating: 5,
        amenities: ["Sea View", "Pool", "Spa", "Gym", "Fine Dining"],
        checkInTime: "14:00",
        checkOutTime: "12:00",
        images: ["https://example.com/leela1.jpg"],
    },
    {
        name: "Taj Mahal Tower",
        description: "Iconic sea-facing hotel offering spectacular views of the Arabian Sea and Gateway of India.",
        address: "Apollo Bunder, Colaba",
        city: "Mumbai",
        state: "Maharashtra",
        starRating: 5,
        amenities: ["Free WiFi", "Swimming Pool", "Jiva Spa", "Fitness Centre", "Award-winning Dining"],
        checkInTime: "14:00",
        checkOutTime: "12:00",
        images: ["https://example.com/tajmumbai1.jpg"],
    },
];

const roomsDataTemplate = [
    {
        roomType: "Deluxe King Room",
        description: "Spacious room with a comfortable king-size bed and modern amenities.",
        pricePerNight: 5500,
        capacity: { adults: 2, children: 1 },
        totalRooms: 15,
        bedType: "King",
        amenities: ["AC", "TV", "Mini Bar", "City View"],
    },
    {
        roomType: "Executive Suite",
        description: "Premium suite with a separate living area and exclusive lounge access.",
        pricePerNight: 12500,
        capacity: { adults: 2, children: 2 },
        totalRooms: 5,
        bedType: "King",
        amenities: ["AC", "TV", "Mini Bar", "Sea View", "Lounge Access", "Bathtub"],
    },
    {
        roomType: "Standard Twin Room",
        description: "Comfortable room featuring two twin beds, perfect for friends traveling together.",
        pricePerNight: 4000,
        capacity: { adults: 2, children: 0 },
        totalRooms: 20,
        bedType: "Twin",
        amenities: ["AC", "TV", "Desk"],
    }
];

const seedHotels = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB...");

        // 1. Find a vendor to own the hotels
        const vendor = await User.findOne({ role: "vendor" });
        if (!vendor) {
            console.error("No vendor found in the database. Please create a vendor user first.");
            process.exit(1);
        }

        // 2. Clear existing hotel data
        await Hotel.deleteMany({});
        await Room.deleteMany({});
        console.log("Cleared existing hotels and rooms.");

        // 3. Insert hotels
        const hotelsWithVendor = hotelsData.map((h) => ({ ...h, operatorId: vendor._id }));
        const createdHotels = await Hotel.insertMany(hotelsWithVendor);
        console.log(`Created ${createdHotels.length} hotels.`);

        // 4. Auto-register cities for the autocomplete search
        for (const hotel of createdHotels) {
            await bulkUpsertCities([{ name: hotel.city, state: hotel.state, country: hotel.country || "India" }]);
        }
        console.log("Cities registered for search autocomplete.");

        // 5. Insert rooms for each hotel
        let totalRoomsCreated = 0;
        for (const hotel of createdHotels) {
            const roomsWithHotelId = roomsDataTemplate.map(room => ({
                ...room,
                hotelId: hotel._id,
                // Add a little randomness to prices so they aren't all identical
                pricePerNight: room.pricePerNight + Math.floor(Math.random() * 2000)
            }));
            const createdRooms = await Room.insertMany(roomsWithHotelId);
            totalRoomsCreated += createdRooms.length;
        }
        console.log(`Created ${totalRoomsCreated} rooms across all hotels.`);

        console.log("Hotel module seeding completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding hotels:", error);
        process.exit(1);
    }
};

seedHotels();
