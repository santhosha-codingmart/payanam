import mongoose from "mongoose";

const aircraftSchema = new mongoose.Schema(
  {
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    operatorName: {
      type: String,
      required: true,
      trim: true,
    },
    airlineName: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    manufacturer: {
      type: String,
      enum: [
        "AIRBUS",
        "BOEING",
        "ATR",
        "EMBRAER",
        "BOMBARDIER",
        "DE_HAVILLAND",
      ],
      required: true,
    },
    aircraftType: {
      type: String,
      enum: [
        "AIRBUS_A220",
        "AIRBUS_A319",
        "AIRBUS_A320",
        "AIRBUS_A320NEO",
        "AIRBUS_A321",
        "AIRBUS_A321NEO",
        "AIRBUS_A330",
        "AIRBUS_A330NEO",
        "AIRBUS_A340",
        "AIRBUS_A350",
        "AIRBUS_A380",
        "BOEING_737_700",
        "BOEING_737_800",
        "BOEING_737_MAX8",
        "BOEING_747",
        "BOEING_757",
        "BOEING_767",
        "BOEING_777_200",
        "BOEING_777_300ER",
        "BOEING_777X",
        "BOEING_787_8",
        "BOEING_787_9",
        "BOEING_787_10",
        "ATR_42",
        "ATR_72",
        "EMBRAER_E170",
        "EMBRAER_E175",
        "EMBRAER_E190",
        "EMBRAER_E195",
        "EMBRAER_E190_E2",
        "EMBRAER_E195_E2",
        "CRJ700",
        "CRJ900",
        "CRJ1000",
        "DASH8_Q400",
      ],
      required: true,
    },
    aircraftModel: {
      type: String,
      required: true,
      trim: true,
    },
    cabinClasses: [
      {
        type: String,
        enum: ["ECONOMY", "PREMIUM_ECONOMY", "STANDARD_ECONOMY", "BUSINESS", "BUSINESS_SAVER", "FIRST"],
      },
    ],
    totalSeats: {
      type: Number,
      required: true,
      min: 1,
    },
    economySeats: {
      type: Number,
      default: 0,
    },
    premiumEconomySeats: {
      type: Number,
      default: 0,
    },
    standardEconomySeats: {
      type: Number,
      default: 0,
    },
    businessSeats: {
      type: Number,
      default: 0,
    },
    businessSaverSeats: {
      type: Number,
      default: 0,
    },
    firstClassSeats: {
      type: Number,
      default: 0,
    },
    seatLayout: [
      {
        seatNumber: {
          type: String,
          required: true,
        },
        cabinClass: {
          type: String,
          enum: ["ECONOMY", "PREMIUM_ECONOMY", "STANDARD_ECONOMY", "BUSINESS", "BUSINESS_SAVER", "FIRST"],
          required: true,
        },
        seatType: {
          type: String,
          enum: ["window", "aisle", "middle"],
          default: "aisle",
        },
        row: {
          type: Number,
          required: true,
        },
        column: {
          type: Number,
          required: true,
        },
        isExtraLegroom: {
          type: Boolean,
          default: false,
        },
        isEmergencyExit: {
          type: Boolean,
          default: false,
        },
        isBassinetSeat: {
          type: Boolean,
          default: false,
        },
        isNearLavatory: {
          type: Boolean,
          default: false,
        },
        isNearGalley: {
          type: Boolean,
          default: false,
        },
        hasPowerOutlet: {
          type: Boolean,
          default: false,
        },
        hasUSBCharging: {
          type: Boolean,
          default: false,
        },
        seatPitch: {
          type: Number,
          default: 30,
        },
        seatWidth: {
          type: Number,
          default: 17,
        },
        fare: {
          type: Number,
          default: 0,
        },
      },
    ],
    amenities: [
      {
        type: String,
        enum: [
          "WiFi",
          "Meal",
          "Snack",
          "Entertainment",
          "Power Outlet",
          "USB Charging",
          "Bluetooth Audio",
          "Streaming Entertainment",
          "Blanket",
          "Pillow",
          "Alcohol",
          "Vegetarian Meal",
          "Vegan Meal",
          "Kosher Meal",
          "Halal Meal",
          "Extra Legroom",
          "Priority Boarding",
          "Wheelchair Assistance",
          "Pet Friendly",
          "Infant Bassinet",
          "Lounge Access",
        ],
      },
    ],
    manufacturingYear: {
      type: Number,
      validate: {
        validator: function (v) {
          return !v || v <= new Date().getFullYear();
        },
        message: "Manufacturing year cannot be in the future.",
      },
    },
    serialNumber: {
      type: String,
      trim: true,
    },
    maxRangeKm: {
      type: Number,
    },
    cruiseSpeedKmh: {
      type: Number,
    },
    photos: [
      {
        url: {
          type: String,
        },
        isPrimary: {
          type: Boolean,
          default: false,
        },
      },
    ],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "INACTIVE",
        "MAINTENANCE",
        "GROUNDED",
        "OUT_OF_SERVICE",
        "RETIRED",
        "RESERVED",
        "DELIVERING",
      ],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  },
);
aircraftSchema.pre("save", function () {
  const calculatedTotal =
    (this.economySeats || 0) +
    (this.premiumEconomySeats || 0) +
    (this.standardEconomySeats || 0) +
    (this.businessSeats || 0) +
    (this.businessSaverSeats || 0) +
    (this.firstClassSeats || 0);
  if (this.totalSeats !== calculatedTotal) {
    throw new Error(
      `Total seats (${this.totalSeats}) must equal the sum of economy (${this.economySeats}), premium economy (${this.premiumEconomySeats}), standard economy (${this.standardEconomySeats}), business (${this.businessSeats}), business saver (${this.businessSaverSeats}), and first class (${this.firstClassSeats}) seats.`,
    );
  }
  if (this.cabinClasses && this.cabinClasses.length > 0) {
    const uniqueClasses = new Set(this.cabinClasses);
    if (uniqueClasses.size !== this.cabinClasses.length) {
      throw new Error("Cabin classes cannot contain duplicates.");
    }
  }
});
aircraftSchema.index({
  status: 1,
  averageRating: -1,
});

export const Aircraft = mongoose.model("Aircraft", aircraftSchema);
