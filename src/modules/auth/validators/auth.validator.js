import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email({
      message: "Invalid email address format",
    }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email({
      message: "Invalid email address format",
    }),
    password: z.string().min(8, "Password is needed"),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email({
      message: "Invalid email address format",
    }),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otpCode: z.string().length(6, "OTP must be exactly 6 digits"),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[a-z]/)
      .regex(/[0-9]/)
      .regex(/[^A-Za-z0-9]/),
  }),
});
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(
    /[^A-Za-z0-9]/,
    "Password must contain at least one special character",
  );

export const registerVendorSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email({
      message: "Invalid email address format",
    }),
    password: strongPassword,
    phoneNo: z
      .string()
      .regex(
        /^\+?[1-9]\d{6,14}$/,
        "Enter a valid mobile number (e.g. +919876543210)",
      )
      .optional(),
    companyName: z.string().min(2, "Company name is required"),
    gstNumber: z
      .string({
        required_error: "GST number is required for vendor registration",
      })
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
        "Invalid GST number format (e.g. 33AABCP1234A1ZX)",
      ),
  }),
});

export const registerAdminSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email({
      message: "Invalid email address format",
    }),
    password: strongPassword,
    adminSecretKey: z.string().min(1, "Admin secret key is required"),
  }),
});

export const sendMobileOTPSchema = z.object({
  body: z.object({
    mobile: z
      .string()
      .regex(
        /^\+?[1-9]\d{6,14}$/,
        "Enter a valid mobile number (e.g. +919876543210)",
      ),
  }),
});

export const verifyMobileOTPSchema = z.object({
  body: z.object({
    mobile: z
      .string()
      .regex(/^\+?[1-9]\d{6,14}$/, "Enter a valid mobile number"),
    otpCode: z.string().length(6, "OTP must be exactly 6 digits"),
  }),
});
