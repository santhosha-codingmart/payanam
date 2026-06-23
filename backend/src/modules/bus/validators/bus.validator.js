import { z } from "zod";

// ─── Reusable sub-schemas ────────────────────────────────────────────────────

const HHmm = z.string().regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Must be in HH:mm format (e.g., 22:00)"
);

const objectId = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Must be a valid 24-character MongoDB ObjectId"
);

const seatLayoutItemSchema = z.object({
    seatNumber: z.string().min(1, "Seat number is required"),
    seatType: z.enum(["window", "aisle", "middle"]).optional().default("aisle"),
    deck: z.enum(["lower", "upper"]).optional().default("lower"),
    row: z.number().int().min(1),
    column: z.number().int().min(1),
    isSleeper: z.boolean().optional().default(false),
    fare: z.number().min(0).optional().default(0),
});

const locationSchema = z.object({
    city: z.string().min(2, "City must be at least 2 characters").max(50),
    state: z.string().min(2, "State must be at least 2 characters").max(50),
});

const stopSchema = z.object({
    city: z.string().min(2).max(50),
    state: z.string().max(50).optional(),
    arrivalTime: HHmm,
    departureTime: HHmm,
    distanceFromSource: z.number().min(0).optional().default(0),
    order: z.number().int().min(1),
});

const boardingDroppingSchema = z.object({
    name: z.string().min(2, "Point name is required"),
    address: z.string().optional(),
    time: HHmm,
    landmark: z.string().optional(),
});

const cancellationTierSchema = z.object({
    hoursBeforeDeparture: z.number().int().min(0),
    refundPercentage: z.number().min(0).max(100),
});

// ─── Bus Validators ──────────────────────────────────────────────────────────

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
        seatLayout: z.array(seatLayoutItemSchema).min(1, "At least one seat is required"),
        isGPSAvailable: z.boolean().optional(),
        isLiveTrackingEnabled: z.boolean().optional(),
    }),
});

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

export const busIdParamSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});

// ─── Route Validators ────────────────────────────────────────────────────────

export const createRouteSchema = z.object({
    body: z.object({
        busId: objectId,
        source: locationSchema,
        destination: locationSchema,
        stops: z.array(stopSchema).min(2, "At least 2 stops required (source and destination)"),
        distanceInKm: z.number().min(1, "Distance must be at least 1 km"),
        estimatedDurationInMinutes: z.number().int().min(1, "Duration must be at least 1 minute"),
    }),
});

// ─── Schedule Validators ─────────────────────────────────────────────────────

export const createScheduleSchema = z.object({
    body: z.object({
        routeId: objectId,
        busId: objectId,
        departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
        departureTime: HHmm,
        arrivalTime: HHmm,
        baseFare: z.number().min(0, "Fare cannot be negative"),
        boardingPoints: z.array(boardingDroppingSchema).min(1, "At least 1 boarding point required").optional(),
        droppingPoints: z.array(boardingDroppingSchema).min(1, "At least 1 dropping point required").optional(),
        cancellationPolicy: z.array(cancellationTierSchema).optional(),
    }),
});

export const scheduleIdParamSchema = z.object({
    params: z.object({
        scheduleId: objectId,
    }),
});

// ─── Search Validator ────────────────────────────────────────────────────────

export const searchBusSchema = z.object({
    query: z.object({
        from: z.string().min(2, "Source city is required"),
        to: z.string().min(2, "Destination city is required"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    }),
});
