import mongoose from "mongoose";

const airportSchema = new mongoose.Schema(
  {
    iataCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      index: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
    },
    popularity: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Airport = mongoose.model("Airport", airportSchema);
