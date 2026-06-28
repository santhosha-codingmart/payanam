// =============================================================================
// Booking Validations — Zod schemas for every booking endpoint
//
// WHY ZOD:
// Zod validates incoming request data BEFORE it hits the controller.
// This ensures that bad input (missing fields, wrong types) is rejected
// with a clean 400 error, and no invalid data ever reaches the database.
// =============================================================================

import { z } from "zod";

// Reusable: validates MongoDB ObjectId format (24-char hex string)
const objectId = z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    "Must be a valid 24-character MongoDB ObjectId"
);

// ─── CREATE BOOKING (Phase 2) ────────────────────────────────────────────────
//
// Validates POST /api/v1/bookings
// The frontend sends this after a successful seat block.
//
// Example request body:
// {
//   "scheduleId": "665f1a2b3c4d5e6f7a8b9c0d",
//   "boardingPointId": "665f...",
//   "droppingPointId": "665f...",
//   "passengerDetails": [
//     { "seatNumber": "L1", "name": "Santhosh", "age": 28, "gender": "male" }
//   ]
// }
export const createBookingSchema = z.object({
    body: z.object({
        scheduleId: objectId,

        // The frontend sends the ObjectId of the chosen boarding/dropping point
        // from the list returned by the Schedule's boardingPoints array
        boardingPointId: objectId,
        droppingPointId: objectId,

        // One passenger entry per seat
        passengerDetails: z
            .array(
                z.object({
                    seatNumber: z.string().min(1, "Seat number is required"),
                    name: z.string().min(2).max(100),
                    age: z.number().int().min(1).max(120),
                    gender: z.enum(["male", "female", "other"]),
                    idType: z
                        .enum(["AADHAR", "PAN", "PASSPORT", "DRIVING_LICENSE"])
                        .optional()
                        .nullable(),
                    idNumber: z.string().optional().nullable(),
                })
            )
            .min(1, "At least one passenger is required"),
    }),
});

// ─── CANCEL BOOKING (Phase 4) ────────────────────────────────────────────────
//
// Validates POST /api/v1/bookings/:bookingId/cancel
// Body is intentionally empty — the bookingId in the URL is enough.
export const cancelBookingSchema = z.object({
    params: z.object({
        bookingId: z.string().min(1, "Booking ID is required"),
    }),
});

// ─── GET BOOKING BY ID ───────────────────────────────────────────────────────
//
// Validates GET /api/v1/bookings/:bookingId
export const getBookingSchema = z.object({
    params: z.object({
        bookingId: z.string().min(1, "Booking ID is required"),
    }),
});
