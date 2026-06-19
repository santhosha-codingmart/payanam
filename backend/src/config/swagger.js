import swaggerJSDoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Payanam API",
            version: "1.0.0",
            description:
                "REST API documentation for the Payanam travel-booking platform. " +
                "All protected endpoints require a valid `accessToken` cookie (JWT). " +
                "Use `/api/auth/login` first, then your browser will send the cookie automatically.",
            contact: {
                name: "Payanam Backend Team",
            },
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local development server",
            },
        ],
        components: {
            // ── Reusable Schemas ───────────────────────────────────────────
            schemas: {
                // ── Generic success ──────────────────────────────────────
                SuccessResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Operation successful" },
                    },
                },

                // ── Generic error ────────────────────────────────────────
                ErrorResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: false },
                        message: { type: "string", example: "Something went wrong" },
                        errors: {
                            type: "array",
                            items: { type: "string" },
                            description: "Validation error details (only present on 400)",
                            example: ["Password must contain at least one uppercase letter"],
                        },
                    },
                },

                // ── Auth ─────────────────────────────────────────────────
                RegisterRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            example: "user@example.com",
                        },
                        password: {
                            type: "string",
                            format: "password",
                            minLength: 8,
                            example: "MyP@ssw0rd",
                            description:
                                "Min 8 chars, must include uppercase, lowercase, digit and special character.",
                        },
                    },
                },

                LoginRequest: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            example: "user@example.com",
                        },
                        password: {
                            type: "string",
                            format: "password",
                            example: "MyP@ssw0rd",
                        },
                    },
                },

                AuthUserResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Login successful" },
                        user: {
                            type: "object",
                            properties: {
                                id: {
                                    type: "string",
                                    example: "665f1a2b3c4d5e6f7a8b9c0d",
                                },
                                email: {
                                    type: "string",
                                    format: "email",
                                    example: "user@example.com",
                                },
                            },
                        },
                    },
                },

                ForgotPasswordRequest: {
                    type: "object",
                    required: ["email"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            example: "user@example.com",
                        },
                    },
                },

                ResetPasswordRequest: {
                    type: "object",
                    required: ["email", "otpCode", "newPassword"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email",
                            example: "user@example.com",
                        },
                        otpCode: {
                            type: "string",
                            minLength: 6,
                            maxLength: 6,
                            example: "482910",
                            description: "The 6-digit OTP sent to the user's email.",
                        },
                        newPassword: {
                            type: "string",
                            format: "password",
                            minLength: 8,
                            example: "N3wP@ssw0rd",
                        },
                    },
                },

                // ── Mobile OTP Auth ───────────────────────────────────────
                SendMobileOTPRequest: {
                    type: "object",
                    required: ["mobile"],
                    properties: {
                        mobile: {
                            type: "string",
                            example: "+919876543210",
                            description: "E.164 format preferred (e.g. +919876543210). Plain 10-digit numbers also accepted.",
                        },
                    },
                },

                VerifyMobileOTPRequest: {
                    type: "object",
                    required: ["mobile", "otpCode"],
                    properties: {
                        mobile: {
                            type: "string",
                            example: "+919876543210",
                        },
                        otpCode: {
                            type: "string",
                            minLength: 6,
                            maxLength: 6,
                            example: "482910",
                            description: "The 6-digit OTP sent via SMS.",
                        },
                    },
                },

                MobileAuthUserResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Mobile verification successful." },
                        user: {
                            type: "object",
                            properties: {
                                id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                                mobile: { type: "string", example: "+919876543210" },
                            },
                        },
                    },
                },

                // ── User Profile ─────────────────────────────────────────
                UpdateProfileRequest: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            example: "Santhosh",
                            description: "2–50 characters",
                        },
                        age: {
                            type: "integer",
                            example: 25,
                            description: "1–120",
                        },
                        email: {
                            type: "string",
                            format: "email",
                            example: "santhosh@example.com",
                        },
                        phoneNo: {
                            type: "string",
                            example: "+919876543210",
                        },
                    },
                },

                UserProfileResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Profile fetched successfully." },
                        data: {
                            type: "object",
                            properties: {
                                _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                                name: { type: "string", example: "Santhosh" },
                                age: { type: "integer", example: 25 },
                                email: { type: "string", example: "santhosh@example.com" },
                                phoneNo: { type: "string", example: "+919876543210" },
                                role: { type: "string", example: "user" },
                                isEmailVerified: { type: "boolean", example: false },
                                isPhoneVerified: { type: "boolean", example: true },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },
            },


            // ── Cookie-based JWT auth (accessToken) ────────────────────────
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "accessToken",
                    description:
                        "HTTP-only cookie set automatically after login. " +
                        "Swagger UI cannot send cookies cross-origin; test protected routes with a browser or Postman.",
                },
            },
        },
    },

    // swagger-jsdoc will scan these files for @swagger JSDoc comments
    apis: ["./src/modules/**/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
