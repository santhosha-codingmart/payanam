import { z } from "zod";

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
    email: z.string().email("Invalid email address format").optional(),
    phoneNo: z
      .string()
      .regex(
        /^\+?[1-9]\d{6,14}$/,
        "Enter a valid phone number (e.g. +919876543210)",
      )
      .optional(),
    companyName: z
      .string()
      .min(2, "Company name must be at least 2 characters")
      .optional(),
    gstNumber: z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GST number format (e.g. 33AABCP1234A1ZX)",
      )
      .optional(),
  }),
});
