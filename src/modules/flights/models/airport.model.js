import mongoose from "mongoose";

const airportSchema = new mongoose.Schema(
    {
        // IATA 3-letter code (e.g., "DEL", "BOM") - This is the primary identifier
        iataCode: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            minlength: 3,
            maxlength: 3,
            index: true,
            unique: true, // No two airports have the same IATA code
        },

        // Full name of the airport (e.g., "Indira Gandhi International Airport")
        name: {
            type: String,
            required: true,
            trim: true,
        },

        // The city this airport serves (e.g., "Delhi")
        city: {
            type: String,
            required: true,
            trim: true,
            index: true, // Fast lookup by city
        },

        // Country
        country: {
            type: String,
            default: "India",
            trim: true,
        },

        // Popularity score based on how often this airport is used in routes
        popularity: {
            type: Number,
            default: 0,
            index: true, // So we can sort popular airports first in search results
        },
    },
    {
        timestamps: true,
    }
);

export const Airport = mongoose.model("Airport", airportSchema);
