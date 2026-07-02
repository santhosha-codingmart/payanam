// ─────────────────────────────────────────────────────────────────────────────
// Flight Validator — The Gatekeeper for the Flights Module
// This file uses Zod (a TypeScript-first schema validation library) to validate
// ALL incoming request data BEFORE it reaches the controller.
//
// HOW ZOD WORKS HERE:
//   Each exported schema (e.g., `createFlightSchema`) is passed to the
//   `validate(schema)` middleware in the route file. The middleware calls
//   `schema.parse({ body: req.body, params: req.params, query: req.query })`
//   and returns a 400 error if anything is invalid — saving us from writing
//   manual if-checks inside every controller.
//
// PATTERN:
//   - Wrap `body`, `params`, or `query` in a top-level z.object()
//   - Reuse sub-schemas (HHmm, objectId, etc.) to keep things DRY
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Reusable Primitives ──────────────────────────────────────────────────────
// Define these once here so they don't need to be repeated in every schema.

// Validates 24-hour time strings (e.g., "06:30", "23:59")
const HHmm = z.string().regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Must be in HH:mm format (e.g., 06:30)"
);

// Validates MongoDB ObjectIds — 24-character hex strings
// E.g., "665f1a2b3c4d5e6f7a8b9c0d"
const objectId = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Must be a valid 24-character MongoDB ObjectId"
);

// Validates IATA airport codes (exactly 3 uppercase letters, e.g., "DEL", "BOM")
// The regex enforces uppercase alphabet only, but the DB also auto-uppercases.
const iataCode = z.string().regex(
    /^[A-Z]{3}$/,
    "IATA code must be exactly 3 uppercase letters (e.g., DEL, BOM)"
);

// ─── Seat Layout Item Sub-Schema ─────────────────────────────────────────────
// Validates a single seat in the aircraft's seatLayout array.
// E.g., { seatNumber: "3A", cabinClass: "ECONOMY", seatType: "window", row: 3, column: "A" }
const seatLayoutItemSchema = z.object({
    seatNumber: z.string().min(1, "Seat number is required"),
    cabinClass: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).optional().default("ECONOMY"),
    seatType: z.enum(["window", "aisle", "middle"]).optional().default("aisle"),
    row: z.number().int().min(1, "Row must be a positive integer"),
    column: z.string().min(1).max(1, "Column must be a single letter (A-F)"),
    isExtraLegroom: z.boolean().optional().default(false),
    fare: z.number().min(0, "Fare cannot be negative").optional().default(0),
});

// ─── Airport Sub-Schema ───────────────────────────────────────────────────────
// Validates an airport object used for source and destination in a FlightRoute.
const airportSchema = z.object({
    name: z.string().min(3, "Airport name is required").max(100),
    iataCode: iataCode,
    city: z.string().min(2, "City is required").max(50),
    country: z.string().min(2, "Country is required").max(50).optional().default("India"),
});

// ─── Stop Sub-Schema ─────────────────────────────────────────────────────────
// Validates a single entry in the route's `stops` array.
// Each stop must have timing data and an order number for direction checking.
const stopSchema = z.object({
    name: z.string().min(3, "Airport name is required").max(100),
    iataCode: iataCode,
    city: z.string().min(2, "City is required").max(50),
    country: z.string().max(50).optional().default("India"),
    arrivalTime: HHmm,
    departureTime: HHmm,
    // How many minutes have elapsed from the source by the time the flight
    // reaches this stop? Used for duration calculation on partial routes.
    minutesFromSource: z.number().min(0).optional().default(0),
    // REQUIRED: Enforces directional order. DEL=1, BOM=2, GOA=3.
    // Prevents showing a DEL→GOA flight as a GOA→DEL result.
    order: z.number().int().min(1, "Stop order must be at least 1"),
});

// ─── Cancellation Tier Sub-Schema ────────────────────────────────────────────
// Validates a single refund tier in the cancellation policy array.
// E.g., { hoursBeforeDeparture: 24, refundPercentage: 75 }
const cancellationTierSchema = z.object({
    hoursBeforeDeparture: z.number().int().min(0, "Cannot be negative"),
    refundPercentage: z.number().min(0).max(100, "Must be between 0 and 100"),
});

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT CRUD Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Validates POST /api/v1/flights (create a new aircraft)
export const createFlightSchema = z.object({
    body: z.object({
        operatorName: z.string().min(2, "Operator name required").max(100),
        airlineName: z.string().min(2, "Airline name required").max(100),
        manufacturer: z.enum([
            "AIRBUS", "BOEING", "ATR", "EMBRAER", "BOMBARDIER", "DE_HAVILLAND"
        ]),
        
        aircraftModel: z.string().min(2, "Aircraft model required").max(50),

        // Must be one of the defined aircraft types
        aircraftType: z.enum([
            "AIRBUS_A220", "AIRBUS_A319", "AIRBUS_A320", "AIRBUS_A320NEO",
            "AIRBUS_A321", "AIRBUS_A321NEO", "AIRBUS_A330", "AIRBUS_A330NEO",
            "AIRBUS_A340", "AIRBUS_A350", "AIRBUS_A380",
            "BOEING_737_700", "BOEING_737_800", "BOEING_737_MAX8",
            "BOEING_747", "BOEING_757", "BOEING_767", "BOEING_777_200",
            "BOEING_777_300ER", "BOEING_777X", "BOEING_787_8", "BOEING_787_9", "BOEING_787_10",
            "ATR_42", "ATR_72",
            "EMBRAER_E170", "EMBRAER_E175", "EMBRAER_E190", "EMBRAER_E195",
            "EMBRAER_E190_E2", "EMBRAER_E195_E2",
            "CRJ700", "CRJ900", "CRJ1000",
            "DASH8_Q400"
        ]),

        // The cabin configuration of this aircraft
        cabinClasses: z.array(z.enum([
            "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"
        ])).min(1, "At least one cabin class must be provided"),

        totalSeats: z.number().int().min(1).max(500),
        economySeats: z.number().int().min(0).optional(),
        premiumEconomySeats: z.number().int().min(0).optional(),
        businessSeats: z.number().int().min(0).optional(),
        firstClassSeats: z.number().int().min(0).optional(),

        amenities: z.array(z.enum([
            "WiFi", "Meal", "Snack", "Entertainment", 
            "Power Outlet", "USB Charging", "Bluetooth Audio", 
            "Streaming Entertainment", "Blanket", "Pillow", 
            "Alcohol", "Vegetarian Meal", "Vegan Meal", 
            "Kosher Meal", "Halal Meal", "Extra Legroom", 
            "Priority Boarding", "Wheelchair Assistance", 
            "Pet Friendly", "Infant Bassinet", "Lounge Access"
        ])).optional().default([]),

        // Aircraft MUST have a seat layout — used to create the seat snapshot
        // in every FlightSchedule created for this aircraft.
        seatLayout: z.array(seatLayoutItemSchema).min(1, "At least one seat is required"),
    }),
});

// Validates PATCH /api/v1/flights/:id (partial update)
// All body fields are optional because it's a partial update (PATCH semantics).
export const updateFlightSchema = z.object({
    params: z.object({
        id: objectId, // Must be a valid MongoDB ObjectId
    }),
    body: z.object({
        operatorName: z.string().min(2).max(100).optional(),
        airlineName: z.string().min(2).max(100).optional(),
        registrationNumber: z.string().min(4).max(20).optional(),
        manufacturer: z.enum([
            "AIRBUS", "BOEING", "ATR", "EMBRAER", "BOMBARDIER", "DE_HAVILLAND"
        ]).optional(),
        aircraftModel: z.string().min(2).max(50).optional(),
        aircraftType: z.enum([
            "AIRBUS_A220", "AIRBUS_A319", "AIRBUS_A320", "AIRBUS_A320NEO",
            "AIRBUS_A321", "AIRBUS_A321NEO", "AIRBUS_A330", "AIRBUS_A330NEO",
            "AIRBUS_A340", "AIRBUS_A350", "AIRBUS_A380",
            "BOEING_737_700", "BOEING_737_800", "BOEING_737_MAX8",
            "BOEING_747", "BOEING_757", "BOEING_767", "BOEING_777_200",
            "BOEING_777_300ER", "BOEING_777X", "BOEING_787_8", "BOEING_787_9", "BOEING_787_10",
            "ATR_42", "ATR_72",
            "EMBRAER_E170", "EMBRAER_E175", "EMBRAER_E190", "EMBRAER_E195",
            "EMBRAER_E190_E2", "EMBRAER_E195_E2",
            "CRJ700", "CRJ900", "CRJ1000",
            "DASH8_Q400"
        ]).optional(),
        cabinClasses: z.array(z.enum([
            "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"
        ])).optional(),
        totalSeats: z.number().int().min(1).max(500).optional(),
        amenities: z.array(z.enum([
            "WiFi", "Meal", "Snack", "Entertainment", 
            "Power Outlet", "USB Charging", "Bluetooth Audio", 
            "Streaming Entertainment", "Blanket", "Pillow", 
            "Alcohol", "Vegetarian Meal", "Vegan Meal", 
            "Kosher Meal", "Halal Meal", "Extra Legroom", 
            "Priority Boarding", "Wheelchair Assistance", 
            "Pet Friendly", "Infant Bassinet", "Lounge Access"
        ])).optional(),
        seatLayout: z.array(seatLayoutItemSchema).min(1).optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
    }),
});

// Used for GET and DELETE routes that only need a flight ID in the URL.
// E.g., GET /api/v1/flights/:id
export const flightIdParamSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT ROUTE Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Validates POST /api/v1/flights/routes (create a route for an aircraft)
export const createFlightRouteSchema = z.object({
    body: z.object({
        flightId: objectId,          // Which aircraft operates this route?
        source: airportSchema,        // Departure airport
        destination: airportSchema,  // Arrival airport

        // Must include at least source + destination (min 2 stops).
        // Additional stops in between represent layovers.
        stops: z.array(stopSchema).min(2, "At least 2 stops required (departure and arrival airports)"),

        distanceInKm: z.number().min(1, "Distance must be at least 1 km"),
        estimatedDurationInMinutes: z.number().int().min(1, "Duration must be at least 1 minute"),
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHT SCHEDULE Schemas
// ─────────────────────────────────────────────────────────────────────────────

// Validates POST /api/v1/flights/schedules (create a scheduled trip)
export const createFlightScheduleSchema = z.object({
    body: z.object({
        routeId: objectId,   // Which route does this schedule follow?
        flightId: objectId,  // Which aircraft is flying?
        flightNumber: z.string().min(2, "Flight number is required").max(20),

        // Travel dates in YYYY-MM-DD format
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),

        departureTime: HHmm,
        arrivalTime: HHmm,

        baseFare: z.number().min(0, "Fare cannot be negative"),

        // Optional terminal info (e.g., "Terminal 3", "T1")
        departureTerminal: z.string().optional(),
        arrivalTerminal: z.string().optional(),

        // Optional meal selections for this flight
        mealOptions: z.array(z.enum([
            "VEG", "NON_VEG", "VEGAN", "JAIN", "DIABETIC",
        ])).optional(),

        // If omitted, a sensible default 4-tier policy is applied by the service
        cancellationPolicy: z.array(cancellationTierSchema).optional(),
    }),
});

// Validates routes with :scheduleId URL parameter
// E.g., GET /api/v1/flights/schedules/:scheduleId/seats
export const scheduleIdParamSchema = z.object({
    params: z.object({
        scheduleId: objectId,
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH Schema
// ─────────────────────────────────────────────────────────────────────────────

// Validates GET /api/v1/flights/search?from=DEL&to=BOM&date=2026-07-01
// Note: validates `req.query` instead of `req.body`.
// Supports both IATA code search ("DEL") and city name search ("Delhi").
export const searchFlightSchema = z.object({
    query: z.object({
        from: z.string().min(2, "Source is required (city name or IATA code)"),
        to: z.string().min(2, "Destination is required (city name or IATA code)"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        // Optional filters — validated loosely here;
        // the service layer does the real filtering logic.
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// SEAT BLOCKING Schema
// ─────────────────────────────────────────────────────────────────────────────

// Validates POST /api/v1/flights/schedules/:scheduleId/block-seats
export const blockSeatsSchema = z.object({
    params: z.object({
        scheduleId: objectId,
    }),
    body: z.object({
        // At least one seat must be selected (e.g., ["3A", "3B"])
        seatNumbers: z.array(z.string()).min(1, "At least one seat must be selected"),
    }),
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW Schema
// ─────────────────────────────────────────────────────────────────────────────

// Validates POST /api/v1/flights/:flightId/reviews
export const createFlightReviewSchema = z.object({
    params: z.object({
        flightId: objectId, // Which flight (aircraft) is being reviewed?
    }),
    body: z.object({
        bookingId: objectId,
        rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
        review: z.string().min(10, "Review must be at least 10 characters").max(1000),
    }),
});
