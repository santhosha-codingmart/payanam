import { z } from "zod";

/**
 * Validation schema for PUT /api/users/profile
 *
 * All fields are optional — the user can update one field at a time.
 * But if a field IS provided, it must pass the format checks.
 */
export const updateProfileSchema = z.object({
    body: z.object({
        name: z
            .string()
            .min(2, "Name must be at least 2 characters")
            .max(50, "Name cannot exceed 50 characters")
            .optional(),

        age: z
            .number()
            .int("Age must be a whole number")
            .min(1, "Age must be at least 1")
            .max(120, "Age cannot exceed 120")
            .optional(),

        email: z
            .string()
            .email("Invalid email address format")
            .optional(),

        phoneNo: z
            .string()
            .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid phone number (e.g. +919876543210)")
            .optional(),
    })
});
