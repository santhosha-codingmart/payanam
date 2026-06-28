// ─────────────────────────────────────────────────────────────────────────────
// Bus Validator — The Gatekeeper
// This file uses Zod (a schema validation library) to check incoming request
// data BEFORE it reaches the controller. If validation fails, it throws a 400
// error and stops the request immediately.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from "zod";

// ─── Reusable Sub-Schemas ────────────────────────────────────────────────────
// Defining these here prevents us from writing the same regex 10 times.

// Validates 24-hour time format (e.g., "09:30", "22:45")
const HHmm = z.string().regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Must be in HH:mm format (e.g., 22:00)"
);

// Validates MongoDB ObjectIds (24-character hex strings)
// E.g., "665f1a2b3c4d5e6f7a8b9c0d"
const objectId = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Must be a valid 24-character MongoDB ObjectId"
);

// Validates a single seat in the bus layout array
const seatLayoutItemSchema = z.object({
    seatNumber: z.string().min(1, "Seat number is required"),
    seatType: z.enum(["window", "aisle", "middle"]).optional().default("aisle"),
    deck: z.enum(["lower", "upper"]).optional().default("lower"),
    row: z.number().int().min(1),
    column: z.number().int().min(1),
    isSleeper: z.boolean().optional().default(false),
    fare: z.number().min(0).optional().default(0),
});

// Validates a simple city/state pair
const locationSchema = z.object({
    city: z.string().min(2, "City must be at least 2 characters").max(50),
    state: z.string().min(2, "State must be at least 2 characters").max(50),
});

// Validates a stop on a route
const stopSchema = z.object({
    city: z.string().min(2).max(50),
    state: z.string().max(50).optional(),
    arrivalTime: HHmm,
    departureTime: HHmm,
    distanceFromSource: z.number().min(0).optional().default(0),
    order: z.number().int().min(1), // Crucial for direction checks (Chennai=1, Vellore=2)
});

// Validates a boarding or dropping point for a schedule
const boardingDroppingSchema = z.object({
    name: z.string().min(2, "Point name is required"),
    address: z.string().optional(),
    time: HHmm,
    landmark: z.string().optional(),
});

// Validates cancellation refund tiers
const cancellationTierSchema = z.object({
    hoursBeforeDeparture: z.number().int().min(0),
    refundPercentage: z.number().min(0).max(100),
});

// ─── Bus Request Validators ──────────────────────────────────────────────────

// Validates POST /api/v1/buses
// Notice we validate `req.body` specifically.
export const createBusSchema = z.object({
    body: z.object({
        operatorName: z.string().min(2).max(100),
        busName: z.string().min(2, "Bus name must be at least 2 characters").max(100),
        busNumber: z.string().min(2).max(20),
        registrationNumber: z.string().min(4, "Registration number is required").max(20),
        busType: z.enum([
            "AC_SLEEPER", "NON_AC_SLEEPER", "AC_SEATER",
            "NON_AC_SEATER", "VOLVO_AC", "SEMI_SLEEPER", "LUXURY_SLEEPER",
        ]),
        seatLayoutType: z.enum(["2+1_SLEEPER", "2+2_SEATER", "1+1_SLEEPER", "2+1_SEATER"]),
        totalSeats: z.number().int().min(1).max(100),
        lowerDeckSeats: z.number().int().min(0).optional(),
        upperDeckSeats: z.number().int().min(0).optional(),
        sleeperSeats: z.number().int().min(0).optional(),
        seaterSeats: z.number().int().min(0).optional(),
        isAC: z.boolean().optional(),
        isSleeper: z.boolean().optional(),
        isSeater: z.boolean().optional(),
        amenities: z.array(z.enum([
            "WiFi", "Charging Point", "Blanket", "Water Bottle",
            "Reading Light", "GPS Tracking", "Emergency Exit", "CCTV",
        ])).optional().default([]),
        
        // A bus MUST have a seat layout, otherwise trips can't be booked
        seatLayout: z.array(seatLayoutItemSchema).min(1, "At least one seat is required"),
        isGPSAvailable: z.boolean().optional(),
        isLiveTrackingEnabled: z.boolean().optional(),
    }),
});

// Validates PATCH /api/v1/buses/:id
// Validates BOTH req.params.id AND req.body.
// Everything in the body is `.optional()` because it's a partial update.
export const updateBusSchema = z.object({
    params: z.object({
        id: objectId,
    }),
    body: z.object({
        operatorName: z.string().min(2).max(100).optional(),
        busName: z.string().min(2).max(100).optional(),
        busNumber: z.string().min(2).max(20).optional(),
        registrationNumber: z.string().min(4).max(20).optional(),
        busType: z.enum([
            "AC_SLEEPER", "NON_AC_SLEEPER", "AC_SEATER",
            "NON_AC_SEATER", "VOLVO_AC", "SEMI_SLEEPER", "LUXURY_SLEEPER",
        ]).optional(),
        seatLayoutType: z.enum(["2+1_SLEEPER", "2+2_SEATER", "1+1_SLEEPER", "2+1_SEATER"]).optional(),
        totalSeats: z.number().int().min(1).max(100).optional(),
        amenities: z.array(z.enum([
            "WiFi", "Charging Point", "Blanket", "Water Bottle",
            "Reading Light", "GPS Tracking", "Emergency Exit", "CCTV",
        ])).optional(),
        seatLayout: z.array(seatLayoutItemSchema).min(1).optional(),
        isActive: z.boolean().optional(),
        status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).optional(),
    }),
});

// Used for GET and DELETE routes that only need an ID parameter
// E.g., GET /api/v1/buses/:id
export const busIdParamSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});

// ─── Route Request Validators ────────────────────────────────────────────────

// Validates POST /api/v1/buses/routes
export const createRouteSchema = z.object({
    body: z.object({
        busId: objectId,
        source: locationSchema,
        destination: locationSchema,
        
        // Route must have at least the source and destination in the stops array
        stops: z.array(stopSchema).min(2, "At least 2 stops required (source and destination)"),
        
        distanceInKm: z.number().min(1, "Distance must be at least 1 km"),
        farePerKm: z.number().min(0, "Fare per km cannot be negative").optional(),
        estimatedDurationInMinutes: z.number().int().min(1, "Duration must be at least 1 minute"),
    }),
});

// ─── Schedule Request Validators ─────────────────────────────────────────────

// Validates POST /api/v1/buses/schedules
export const createScheduleSchema = z.object({
    body: z.object({
        routeId: objectId,
        busId: objectId,
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        departureTime: HHmm,
        arrivalTime: HHmm,
        baseFare: z.number().min(0, "Fare cannot be negative"),
        
        // Boarding points are optional here because the service will
        // auto-generate them from the Route stops if they are missing.
        boardingPoints: z.array(boardingDroppingSchema).min(1, "At least 1 boarding point required").optional(),
        droppingPoints: z.array(boardingDroppingSchema).min(1, "At least 1 dropping point required").optional(),
        cancellationPolicy: z.array(cancellationTierSchema).optional(),
    }),
});

// Validates GET /api/v1/buses/schedules/:scheduleId/seats
export const scheduleIdParamSchema = z.object({
    params: z.object({
        scheduleId: objectId,
    }),
});

// ─── Search Request Validator ────────────────────────────────────────────────

// Validates GET /api/v1/buses/search?from=X&to=Y&date=Z
// Notice we validate `req.query` here instead of `req.body`.
export const searchBusSchema = z.object({
    query: z.object({
        from: z.string().min(2, "Source city is required"),
        to: z.string().min(2, "Destination city is required"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        
        // Note: The schema doesn't strictly validate optional filters like
        // busType or maxPrice, which means any extra query params are
        // allowed but just ignored if the controller doesn't use them.
    }),
});

// ─── Seat Blocking Validator (Phase 1) ───────────────────────────────────────
export const blockSeatsSchema = z.object({
    params: z.object({
        scheduleId: objectId,
    }),
    body: z.object({
        seatNumbers: z.array(z.string()).min(1, "At least one seat must be selected"),
    }),
});

// ─── Review Validator (Phase 5) ──────────────────────────────────────────────
export const createReviewSchema = z.object({
    params: z.object({
        busId: objectId,
    }),
    body: z.object({
        bookingId: objectId,
        rating: z.number().min(1).max(5),
        review: z.string().min(10, "Review must be at least 10 characters long").max(1000),
    }),
});
