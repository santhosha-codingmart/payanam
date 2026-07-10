import { z } from "zod";

const HHmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be in HH:mm format (e.g., 06:30)");
const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid 24-character MongoDB ObjectId");
const iataCode = z
  .string()
  .regex(
    /^[A-Z]{3}$/,
    "IATA code must be exactly 3 uppercase letters (e.g., DEL, BOM)",
  );
const seatLayoutItemSchema = z.object({
  seatNumber: z.string().min(1, "Seat number is required"),
  cabinClass: z
    .enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"])
    .optional()
    .default("ECONOMY"),
  seatType: z.enum(["window", "aisle", "middle"]).optional().default("aisle"),
  row: z.number().int().min(1, "Row must be a positive integer"),
  column: z.string().min(1).max(1, "Column must be a single letter (A-F)"),
  isExtraLegroom: z.boolean().optional().default(false),
  fare: z.number().min(0, "Fare cannot be negative").optional().default(0),
});
const airportSchema = z.object({
  name: z.string().min(3, "Airport name is required").max(100),
  iataCode: iataCode,
  city: z.string().min(2, "City is required").max(50),
  country: z
    .string()
    .min(2, "Country is required")
    .max(50)
    .optional()
    .default("India"),
});
const stopSchema = z.object({
  name: z.string().min(3, "Airport name is required").max(100),
  iataCode: iataCode,
  city: z.string().min(2, "City is required").max(50),
  country: z.string().max(50).optional().default("India"),
  arrivalTime: HHmm,
  departureTime: HHmm,
  minutesFromSource: z.number().min(0).optional().default(0),
  order: z.number().int().min(1, "Stop order must be at least 1"),
});
const cancellationTierSchema = z.object({
  hoursBeforeDeparture: z.number().int().min(0, "Cannot be negative"),
  refundPercentage: z.number().min(0).max(100, "Must be between 0 and 100"),
});

export const createFlightSchema = z.object({
  body: z.object({
    operatorName: z.string().min(2, "Operator name required").max(100),
    airlineName: z.string().min(2, "Airline name required").max(100),
    manufacturer: z.enum([
      "AIRBUS",
      "BOEING",
      "ATR",
      "EMBRAER",
      "BOMBARDIER",
      "DE_HAVILLAND",
    ]),
    aircraftModel: z.string().min(2, "Aircraft model required").max(50),
    aircraftType: z.enum([
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
    ]),
    cabinClasses: z
      .array(z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]))
      .min(1, "At least one cabin class must be provided"),
    totalSeats: z.number().int().min(1).max(500),
    economySeats: z.number().int().min(0).optional(),
    premiumEconomySeats: z.number().int().min(0).optional(),
    businessSeats: z.number().int().min(0).optional(),
    firstClassSeats: z.number().int().min(0).optional(),
    amenities: z
      .array(
        z.enum([
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
        ]),
      )
      .optional()
      .default([]),
    seatLayout: z
      .array(seatLayoutItemSchema)
      .min(1, "At least one seat is required"),
  }),
});

export const updateFlightSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    operatorName: z.string().min(2).max(100).optional(),
    airlineName: z.string().min(2).max(100).optional(),
    registrationNumber: z.string().min(4).max(20).optional(),
    manufacturer: z
      .enum([
        "AIRBUS",
        "BOEING",
        "ATR",
        "EMBRAER",
        "BOMBARDIER",
        "DE_HAVILLAND",
      ])
      .optional(),
    aircraftModel: z.string().min(2).max(50).optional(),
    aircraftType: z
      .enum([
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
      ])
      .optional(),
    cabinClasses: z
      .array(z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]))
      .optional(),
    totalSeats: z.number().int().min(1).max(500).optional(),
    amenities: z
      .array(
        z.enum([
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
        ]),
      )
      .optional(),
    seatLayout: z.array(seatLayoutItemSchema).min(1).optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
  }),
});

export const flightIdParamSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export const createFlightRouteSchema = z.object({
  body: z.object({
    flightId: objectId,
    source: airportSchema,
    destination: airportSchema,
    stops: z
      .array(stopSchema)
      .min(2, "At least 2 stops required (departure and arrival airports)"),
    distanceInKm: z.number().min(1, "Distance must be at least 1 km"),
    estimatedDurationInMinutes: z
      .number()
      .int()
      .min(1, "Duration must be at least 1 minute"),
  }),
});

export const createFlightScheduleSchema = z.object({
  body: z.object({
    routeId: objectId,
    flightId: objectId,
    flightNumber: z.string().min(2, "Flight number is required").max(20),
    departureDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    arrivalDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .optional(),
    departureTime: HHmm,
    arrivalTime: HHmm,
    baseFare: z.number().min(0, "Fare cannot be negative"),
    departureTerminal: z.string().optional(),
    arrivalTerminal: z.string().optional(),
    mealOptions: z
      .array(z.enum(["VEG", "NON_VEG", "VEGAN", "JAIN", "DIABETIC"]))
      .optional(),
    cancellationPolicy: z.array(cancellationTierSchema).optional(),
  }),
});

export const scheduleIdParamSchema = z.object({
  params: z.object({
    scheduleId: objectId,
  }),
});

export const searchFlightSchema = z.object({
  query: z.object({
    from: z.string().min(2, "Source is required (city name or IATA code)"),
    to: z.string().min(2, "Destination is required (city name or IATA code)"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  }),
});

export const blockSeatsSchema = z.object({
  params: z.object({
    scheduleId: objectId,
  }),
  body: z.object({
    seatNumbers: z
      .array(z.string())
      .min(1, "At least one seat must be selected"),
  }),
});

export const createFlightReviewSchema = z.object({
  params: z.object({
    flightId: objectId,
  }),
  body: z.object({
    bookingId: objectId,
    rating: z
      .number()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5"),
    review: z
      .string()
      .min(10, "Review must be at least 10 characters")
      .max(1000),
  }),
});

export const createPriceLockSchema = z.object({
  body: z.object({
    scheduleId: objectId,
    lockDurationId: z.enum(["4h", "8h", "12h", "1d", "3d", "7d"], {
      errorMap: () => ({
        message: "Lock duration must be one of: 4h, 8h, 12h, 1d, 3d, 7d",
      }),
    }),
  }),
});

export const priceLockIdParamSchema = z.object({
  params: z.object({
    priceLockId: z.string().min(1, "Price lock ID is required"),
  }),
});

export const createFlightBookingSchema = z.object({
  body: z.object({
    scheduleId: objectId,
    tripType: z
      .enum(["One Way", "Round Trip", "Multi City"])
      .optional()
      .default("One Way"),
    passengerDetails: z
      .array(
        z.object({
          seatNumber: z.string().min(1, "Seat number is required"),
          name: z.string().min(2).max(100),
          age: z.number().int().min(1).max(120),
          gender: z.enum(["male", "female", "other"]),
        }),
      )
      .min(1, "At least one passenger is required"),
  }),
});
