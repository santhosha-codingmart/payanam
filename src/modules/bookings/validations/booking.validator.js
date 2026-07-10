import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Must be a valid 24-character MongoDB ObjectId");

export const createBookingSchema = z.object({
  body: z.object({
    scheduleId: objectId,
    boardingPointId: objectId,
    droppingPointId: objectId,
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
        }),
      )
      .min(1, "At least one passenger is required"),
  }),
});

export const cancelBookingSchema = z.object({
  params: z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
  }),
});

export const getBookingSchema = z.object({
  params: z.object({
    bookingId: z.string().min(1, "Booking ID is required"),
  }),
});
