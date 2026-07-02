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

                // Updated to include role/name/companyName so the frontend can redirect
                // to the correct dashboard immediately after login without an extra /profile call.
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
                                name: {
                                    type: "string",
                                    nullable: true,
                                    example: "Parveen Kumar",
                                },
                                email: {
                                    type: "string",
                                    format: "email",
                                    example: "user@example.com",
                                },
                                role: {
                                    type: "string",
                                    enum: ["user", "vendor", "admin"],
                                    example: "vendor",
                                    description: "Use this to redirect after login: vendor→dashboard, user→home, admin→admin panel",
                                },
                                companyName: {
                                    type: "string",
                                    nullable: true,
                                    example: "Parveen Travels Pvt. Ltd.",
                                    description: "Only populated for vendors. null for regular users.",
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
                                name: { type: "string", nullable: true, example: "Parveen Kumar" },
                                email: { type: "string", nullable: true, format: "email", example: "user@example.com" },
                                mobile: { type: "string", example: "+919876543210" },
                                role: { type: "string", enum: ["user", "vendor", "admin"], example: "user" },
                                companyName: { type: "string", nullable: true, example: "Parveen Travels Pvt. Ltd." },
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
                        companyName: {
                            type: "string",
                            example: "Parveen Travels Pvt. Ltd.",
                            description: "Vendor only. 2–50 characters",
                        },
                        gstNumber: {
                            type: "string",
                            example: "33AABCP1234A1ZX",
                            description: "Vendor only. Indian GST registration number",
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
                                companyName: { type: "string", nullable: true, example: "Parveen Travels Pvt. Ltd." },
                                gstNumber: { type: "string", nullable: true, example: "33AABCP1234A1ZX" },
                                isEmailVerified: { type: "boolean", example: false },
                                isPhoneVerified: { type: "boolean", example: true },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },

                // ── Bus Module ───────────────────────────────────────────

                SeatLayoutItem: {
                    type: "object",
                    required: ["seatNumber", "row", "column"],
                    properties: {
                        seatNumber: { type: "string", example: "L1" },
                        seatType: { type: "string", enum: ["window", "aisle", "middle"], example: "window" },
                        deck: { type: "string", enum: ["lower", "upper"], example: "lower" },
                        row: { type: "integer", example: 1 },
                        column: { type: "integer", example: 1 },
                        isSleeper: { type: "boolean", example: true },
                        fare: { type: "number", example: 875 },
                    },
                },

                CreateBusRequest: {
                    type: "object",
                    required: ["operatorName", "busName", "busNumber", "registrationNumber", "busType", "seatLayoutType", "totalSeats", "seatLayout"],
                    properties: {
                        operatorName: { type: "string", example: "KPN Travels" },
                        busName: { type: "string", example: "KPN Volvo Multi-Axle" },
                        busNumber: { type: "string", example: "TN01KPN001" },
                        registrationNumber: { type: "string", example: "TN01AB1234" },
                        busType: {
                            type: "string",
                            enum: ["AC_SLEEPER", "NON_AC_SLEEPER", "AC_SEATER", "NON_AC_SEATER", "VOLVO_AC", "SEMI_SLEEPER", "LUXURY_SLEEPER"],
                            example: "AC_SLEEPER",
                        },
                        seatLayoutType: {
                            type: "string",
                            enum: ["2+1_SLEEPER", "2+2_SEATER", "1+1_SLEEPER", "2+1_SEATER"],
                            example: "2+1_SLEEPER",
                        },
                        totalSeats: { type: "integer", example: 36 },
                        lowerDeckSeats: { type: "integer", example: 18 },
                        upperDeckSeats: { type: "integer", example: 18 },
                        sleeperSeats: { type: "integer", example: 36 },
                        seaterSeats: { type: "integer", example: 0 },
                        isAC: { type: "boolean", example: true },
                        isSleeper: { type: "boolean", example: true },
                        isSeater: { type: "boolean", example: false },
                        amenities: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["WiFi", "Charging Point", "Blanket", "Water Bottle", "Reading Light", "GPS Tracking", "Emergency Exit", "CCTV"],
                            },
                            example: ["WiFi", "Charging Point", "Blanket"],
                        },
                        isGPSAvailable: { type: "boolean", example: true },
                        isLiveTrackingEnabled: { type: "boolean", example: true },
                        seatLayout: {
                            type: "array",
                            items: { $ref: "#/components/schemas/SeatLayoutItem" },
                        },
                    },
                },

                UpdateBusRequest: {
                    type: "object",
                    properties: {
                        busName: { type: "string", example: "KPN Volvo 9600" },
                        busNumber: { type: "string", example: "TN01KPN001" },
                        registrationNumber: { type: "string", example: "TN01AB1234" },
                        busType: {
                            type: "string",
                            enum: ["AC_SLEEPER", "NON_AC_SLEEPER", "AC_SEATER", "NON_AC_SEATER", "VOLVO_AC", "SEMI_SLEEPER", "LUXURY_SLEEPER"],
                        },
                        amenities: {
                            type: "array",
                            items: { type: "string" },
                        },
                        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "MAINTENANCE"], example: "ACTIVE" },
                    },
                },

                BusResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Bus created successfully." },
                        data: {
                            type: "object",
                            properties: {
                                _id: { type: "string", example: "682abc1234567890abcd1234" },
                                operatorId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                                operatorName: { type: "string", example: "KPN Travels" },
                                busName: { type: "string", example: "KPN Volvo Multi-Axle" },
                                busNumber: { type: "string", example: "TN01KPN001" },
                                busType: { type: "string", example: "AC_SLEEPER" },
                                totalSeats: { type: "integer", example: 36 },
                                status: { type: "string", example: "ACTIVE" },
                            },
                        },
                    },
                },

                BusListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Buses fetched successfully." },
                        count: { type: "integer", example: 3 },
                        data: {
                            type: "array",
                            items: { type: "object" },
                        },
                    },
                },

                // ── Route ────────────────────────────────────────────────

                StopItem: {
                    type: "object",
                    required: ["city", "arrivalTime", "departureTime", "order"],
                    properties: {
                        city: { type: "string", example: "Vellore" },
                        state: { type: "string", example: "Tamil Nadu" },
                        arrivalTime: { type: "string", example: "00:30", description: "HH:mm format" },
                        departureTime: { type: "string", example: "00:40", description: "HH:mm format" },
                        distanceFromSource: { type: "number", example: 130, description: "Distance in km from source city" },
                        order: { type: "integer", example: 2, description: "Stop sequence (1 = source)" },
                    },
                },

                LocationItem: {
                    type: "object",
                    required: ["city", "state"],
                    properties: {
                        city: { type: "string", example: "Chennai" },
                        state: { type: "string", example: "Tamil Nadu" },
                    },
                },

                CreateRouteRequest: {
                    type: "object",
                    required: ["busId", "source", "destination", "stops", "distanceInKm", "estimatedDurationInMinutes"],
                    properties: {
                        busId: { type: "string", example: "682abc1234567890abcd1234" },
                        source: { $ref: "#/components/schemas/LocationItem" },
                        destination: {
                            type: "object",
                            properties: {
                                city: { type: "string", example: "Bangalore" },
                                state: { type: "string", example: "Karnataka" },
                            },
                        },
                        stops: {
                            type: "array",
                            description: "Ordered list of ALL stops (including source & destination). Must have at least 2.",
                            items: { $ref: "#/components/schemas/StopItem" },
                            example: [
                                { city: "Chennai", state: "Tamil Nadu", arrivalTime: "22:00", departureTime: "22:00", distanceFromSource: 0, order: 1 },
                                { city: "Vellore", state: "Tamil Nadu", arrivalTime: "00:30", departureTime: "00:40", distanceFromSource: 130, order: 2 },
                                { city: "Bangalore", state: "Karnataka", arrivalTime: "04:30", departureTime: "04:30", distanceFromSource: 350, order: 3 },
                            ],
                        },
                        distanceInKm: { type: "number", example: 350 },
                        farePerKm: { type: "number", example: 2.5, description: "Optional. Enables proportional fare for intermediate stops." },
                        estimatedDurationInMinutes: { type: "integer", example: 390 },
                    },
                },

                RouteResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Route created successfully." },
                        data: { type: "object" },
                    },
                },

                RouteListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        count: { type: "integer", example: 2 },
                        data: { type: "array", items: { type: "object" } },
                    },
                },

                // ── Schedule ─────────────────────────────────────────────

                BoardingDroppingPoint: {
                    type: "object",
                    required: ["id", "city", "name", "time"],
                    properties: {
                        id: { type: "string", example: "682abc1234567890abcd5678" },
                        city: { type: "string", example: "Chennai" },
                        name: { type: "string", example: "Koyambedu Bus Stand" },
                        address: { type: "string", example: "Koyambedu, Chennai" },
                        time: { type: "string", example: "22:00", description: "HH:mm format" },
                        landmark: { type: "string", example: "Near Metro Station" },
                    },
                },

                CancellationTier: {
                    type: "object",
                    required: ["hoursBeforeDeparture", "refundPercentage"],
                    properties: {
                        hoursBeforeDeparture: { type: "integer", example: 24 },
                        refundPercentage: { type: "number", example: 75 },
                    },
                },

                CreateScheduleRequest: {
                    type: "object",
                    required: ["routeId", "busId", "departureDate", "departureTime", "arrivalTime", "baseFare"],
                    properties: {
                        routeId: { type: "string", example: "682abc1234567890abcd5678" },
                        busId: { type: "string", example: "682abc1234567890abcd1234" },
                        departureDate: { type: "string", example: "2026-06-25", description: "YYYY-MM-DD" },
                        departureTime: { type: "string", example: "22:00", description: "HH:mm" },
                        arrivalTime: { type: "string", example: "04:30", description: "HH:mm" },
                        baseFare: { type: "number", example: 875 },
                        boardingPoints: {
                            type: "array",
                            items: { $ref: "#/components/schemas/BoardingDroppingPoint" },
                        },
                        droppingPoints: {
                            type: "array",
                            items: { $ref: "#/components/schemas/BoardingDroppingPoint" },
                        },
                        cancellationPolicy: {
                            type: "array",
                            items: { $ref: "#/components/schemas/CancellationTier" },
                            description: "Optional. Defaults to a 4-tier policy if omitted.",
                        },
                    },
                },

                ScheduleResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Schedule created successfully." },
                        data: { type: "object" },
                    },
                },

                ScheduleListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        count: { type: "integer", example: 10 },
                        data: { type: "array", items: { type: "object" } },
                    },
                },

                SeatLayoutResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Seat layout fetched successfully." },
                        data: {
                            type: "object",
                            properties: {
                                scheduleId: { type: "string" },
                                bus: { type: "object" },
                                route: { type: "object" },
                                departureDate: { type: "string", format: "date" },
                                departureTime: { type: "string", example: "22:00" },
                                arrivalTime: { type: "string", example: "04:30" },
                                baseFare: { type: "number", example: 875 },
                                availableSeats: { type: "integer", example: 28 },
                                totalSeats: { type: "integer", example: 36 },
                                seats: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            seatNumber: { type: "string", example: "L1" },
                                            seatType: { type: "string", example: "window" },
                                            deck: { type: "string", example: "lower" },
                                            fare: { type: "number", example: 875 },
                                            status: { type: "string", enum: ["AVAILABLE", "BOOKED", "BLOCKED"], example: "AVAILABLE" },
                                            passengerName: { type: "string", nullable: true },
                                        },
                                    },
                                },
                                boardingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                droppingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                            },
                        },
                    },
                },

                // ── Search ───────────────────────────────────────────────

                SearchResultResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Found 2 bus(es) from Vellore to Bangalore." },
                        count: { type: "integer", example: 2 },
                        data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    scheduleId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                                    operator: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "682abc1234567890abcd1234" },
                                            name: { type: "string", example: "KPN Travels" }
                                        }
                                    },
                                    bus: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string", example: "682abc1234567890abcd1234" },
                                            name: { type: "string", example: "KPN Volvo Multi-Axle" },
                                            number: { type: "string", example: "TN01KPN001" },
                                            type: { type: "string", example: "AC_SLEEPER" },
                                            layout: { type: "string", example: "2+1_SLEEPER" },
                                            isAC: { type: "boolean", example: true },
                                            isSleeper: { type: "boolean", example: true },
                                            isSeater: { type: "boolean", example: false },
                                            amenities: { type: "array", items: { type: "string" }, example: ["WiFi", "Water Bottle"] },
                                            rating: { type: "number", example: 4.5 }
                                        }
                                    },
                                    journey: {
                                        type: "object",
                                        properties: {
                                            departureDate: { type: "string", format: "date-time" },
                                            arrivalDate: { type: "string", format: "date-time" },
                                            departureTime: { type: "string", example: "22:00" },
                                            arrivalTime: { type: "string", example: "04:30" },
                                            durationMinutes: { type: "integer", example: 390 },
                                            source: { type: "string", example: "Chennai" },
                                            destination: { type: "string", example: "Coimbatore" }
                                        }
                                    },
                                    pricing: {
                                        type: "object",
                                        properties: {
                                            baseFare: { type: "number", example: 500 },
                                            calculatedFare: { type: "number", example: 765, description: "Proportional fare for the segment" }
                                        }
                                    },
                                    seats: {
                                        type: "object",
                                        properties: {
                                            available: { type: "integer", example: 28 },
                                            total: { type: "integer", example: 36 }
                                        }
                                    },
                                    boardingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                    droppingPoints: { type: "array", items: { $ref: "#/components/schemas/BoardingDroppingPoint" } },
                                    cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                                    status: { type: "string", example: "SCHEDULED" },
                                },
                            },
                        },
                    },
                },
                // SearchResultResponse closes here ^^^

                // ── Bookings ─────────────────────────────────────────────────

                PassengerDetail: {
                    type: "object",
                    required: ["seatNumber", "name", "age", "gender"],
                    properties: {
                        seatNumber: { type: "string", example: "L1" },
                        name: { type: "string", example: "Santhosh Kumar" },
                        age: { type: "integer", example: 28 },
                        gender: { type: "string", enum: ["male", "female", "other"], example: "male" },
                        idType: { type: "string", nullable: true, example: "AADHAR" },
                        idNumber: { type: "string", nullable: true, example: "1234 5678 9012" },
                    },
                },

                CreateBookingRequest: {
                    type: "object",
                    required: ["scheduleId", "boardingPointId", "droppingPointId", "passengerDetails"],
                    properties: {
                        scheduleId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        boardingPointId: { type: "string", example: "665f1a2b3c4d5e6f7a8b0001" },
                        droppingPointId: { type: "string", example: "665f1a2b3c4d5e6f7a8b0002" },
                        passengerDetails: {
                            type: "array",
                            items: { $ref: "#/components/schemas/PassengerDetail" },
                        },
                    },
                },

                BookingResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Booking confirmed! Your PNR is PAY-A3F2B1." },
                        data: {
                            type: "object",
                            properties: {
                                bookingId: { type: "string", example: "PAY-A3F2B1" },
                                bookingStatus: { type: "string", example: "CONFIRMED" },
                                paymentStatus: { type: "string", example: "SUCCESS" },
                                paymentReference: { type: "string", example: "MOCK-PAY-1719551234000" },
                                totalFare: { type: "number", example: 1750 },
                                bookedSeats: { type: "array", items: { type: "string" }, example: ["L1", "L2"] },
                                bookedAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },

                BookingListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        count: { type: "integer", example: 3 },
                        data: { type: "array", items: { type: "object" } },
                    },
                },

                CancellationResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Booking cancelled. Refund of 656 INR will be credited in 5-7 business days." },
                        data: {
                            type: "object",
                            properties: {
                                bookingId: { type: "string", example: "PAY-A3F2B1" },
                                refundAmount: { type: "number", example: 656 },
                                cancelledAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },

                // ─────────────────────────────────────────────────────────
                // FLIGHTS MODULE
                // ─────────────────────────────────────────────────────────

                // ── Shared sub-schemas ──────────────────────────────────

                // A single seat in an aircraft's seat layout template.
                // Used in CreateFlightRequest.seatLayout array.
                FlightSeatLayoutItem: {
                    type: "object",
                    required: ["seatNumber", "row", "column"],
                    properties: {
                        seatNumber: { type: "string", example: "3A", description: "Seat identifier (row + column letter)" },
                        cabinClass: { type: "string", enum: ["ECONOMY", "BUSINESS", "FIRST"], example: "ECONOMY" },
                        seatType: { type: "string", enum: ["window", "aisle", "middle"], example: "window" },
                        row: { type: "integer", example: 3 },
                        column: { type: "string", example: "A", description: "Single letter A-F" },
                        isExtraLegroom: { type: "boolean", example: false },
                        fare: { type: "number", example: 4500, description: "Base fare for this specific seat" },
                    },
                },

                // An airport with its IATA code — used for source/destination.
                AirportItem: {
                    type: "object",
                    required: ["name", "iataCode", "city", "country"],
                    properties: {
                        name: { type: "string", example: "Indira Gandhi International Airport" },
                        iataCode: { type: "string", minLength: 3, maxLength: 3, example: "DEL", description: "3-letter IATA code" },
                        city: { type: "string", example: "Delhi" },
                        country: { type: "string", example: "India", default: "India" },
                        displayText: { type: "string", example: "Delhi (DEL) - Indira Gandhi International Airport" },
                    },
                },

                AirportSearchResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        data: {
                            type: "array",
                            items: { $ref: "#/components/schemas/AirportItem" },
                        },
                    },
                },

                // A stop in a FlightRoute's ordered stops array.
                // `order` enforces travel direction (DEL=1, BOM=2 → only DEL→BOM is valid).
                FlightStopItem: {
                    type: "object",
                    required: ["name", "iataCode", "city", "arrivalTime", "departureTime", "order"],
                    properties: {
                        name: { type: "string", example: "Chhatrapati Shivaji Maharaj International Airport" },
                        iataCode: { type: "string", example: "BOM" },
                        city: { type: "string", example: "Mumbai" },
                        country: { type: "string", example: "India" },
                        arrivalTime: { type: "string", example: "08:30", description: "HH:mm 24-hour format" },
                        departureTime: { type: "string", example: "08:45", description: "HH:mm 24-hour format" },
                        minutesFromSource: { type: "integer", example: 130, description: "Minutes elapsed from the first departure to this stop. Used for segment duration calculation." },
                        order: { type: "integer", example: 2, description: "Sequence position (1 = departure airport). Prevents reverse-direction matches." },
                    },
                },

                // ── Flight (Aircraft) CRUD ──────────────────────────────

                CreateFlightRequest: {
                    type: "object",
                    required: ["operatorName", "airlineName", "registrationNumber", "manufacturer", "aircraftModel", "aircraftType", "cabinClasses", "totalSeats", "seatLayout"],
                    properties: {
                        operatorName: { type: "string", example: "IndiGo Airlines", description: "Operator/company display name" },
                        airlineName: { type: "string", example: "IndiGo", description: "Short airline brand name" },
                        registrationNumber: { type: "string", example: "VT-IGP", description: "Government-issued aircraft tail number. Must be globally unique." },
                        manufacturer: {
                            type: "string",
                            enum: ["AIRBUS", "BOEING", "ATR", "EMBRAER", "BOMBARDIER", "DE_HAVILLAND"],
                            example: "AIRBUS",
                        },
                        aircraftModel: { type: "string", example: "A320neo" },
                        aircraftType: {
                            type: "string",
                            enum: ["AIRBUS_A320NEO", "BOEING_737_MAX8", "ATR_72"],
                            example: "AIRBUS_A320NEO",
                        },
                        cabinClasses: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"],
                            },
                            example: ["ECONOMY", "BUSINESS"],
                        },
                        totalSeats: { type: "integer", example: 180, description: "Total bookable seats across all cabin classes" },
                        economySeats: { type: "integer", example: 162 },
                        premiumEconomySeats: { type: "integer", example: 0 },
                        businessSeats: { type: "integer", example: 18 },
                        firstClassSeats: { type: "integer", example: 0 },
                        amenities: {
                            type: "array",
                            items: {
                                type: "string",
                                enum: [
                                    "WiFi", "Meal", "Snack", "Entertainment", 
                                    "Power Outlet", "USB Charging", "Bluetooth Audio", 
                                    "Streaming Entertainment", "Blanket", "Pillow", 
                                    "Alcohol", "Vegetarian Meal", "Vegan Meal", 
                                    "Kosher Meal", "Halal Meal", "Extra Legroom", 
                                    "Priority Boarding", "Wheelchair Assistance", 
                                    "Pet Friendly", "Infant Bassinet", "Lounge Access"
                                ],
                            },
                            example: ["Meal", "USB Charging"],
                        },
                        seatLayout: {
                            type: "array",
                            description: "Seat-by-seat layout template. Copied into every FlightSchedule created for this aircraft.",
                            items: { $ref: "#/components/schemas/FlightSeatLayoutItem" },
                        },
                    },
                },

                UpdateFlightRequest: {
                    type: "object",
                    description: "All fields optional — only the provided fields are updated (PATCH semantics).",
                    properties: {
                        airlineName: { type: "string", example: "IndiGo Express" },
                        registrationNumber: { type: "string", example: "VT-IGA" },
                        manufacturer: { type: "string", example: "AIRBUS" },
                        aircraftModel: { type: "string", example: "A321neo" },
                        aircraftType: { type: "string", example: "AIRBUS_A321NEO" },
                        cabinClasses: {
                            type: "array",
                            items: { type: "string" },
                            example: ["ECONOMY"],
                        },
                        amenities: { type: "array", items: { type: "string" } },
                        status: { type: "string", enum: ["ACTIVE", "INACTIVE", "MAINTENANCE", "GROUNDED", "OUT_OF_SERVICE", "RETIRED", "RESERVED", "DELIVERING"], example: "MAINTENANCE" },
                    },
                },

                FlightResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Flight created successfully." },
                        data: {
                            type: "object",
                            properties: {
                                _id: { type: "string", example: "682abc1234567890abcd1234" },
                                operatorId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                                operatorName: { type: "string", example: "IndiGo Airlines" },
                                airlineName: { type: "string", example: "IndiGo" },
                                registrationNumber: { type: "string", example: "VT-IGP" },
                                manufacturer: { type: "string", example: "AIRBUS" },
                                aircraftModel: { type: "string", example: "A320neo" },
                                aircraftType: { type: "string", example: "AIRBUS_A320NEO" },
                                cabinClasses: { type: "array", items: { type: "string" }, example: ["ECONOMY"] },
                                totalSeats: { type: "integer", example: 180 },
                                status: { type: "string", example: "ACTIVE" },
                                averageRating: { type: "number", example: 0 },
                                totalRatings: { type: "integer", example: 0 },
                                createdAt: { type: "string", format: "date-time" },
                            },
                        },
                    },
                },

                FlightListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Flights fetched successfully." },
                        count: { type: "integer", example: 2 },
                        data: { type: "array", items: { type: "object" } },
                    },
                },

                // ── Flight Routes ───────────────────────────────────────

                CreateFlightRouteRequest: {
                    type: "object",
                    required: ["flightId", "source", "destination", "stops", "distanceInKm", "estimatedDurationInMinutes"],
                    properties: {
                        flightId: { type: "string", example: "682abc1234567890abcd1234" },
                        source: { $ref: "#/components/schemas/AirportItem" },
                        destination: {
                            allOf: [{ $ref: "#/components/schemas/AirportItem" }],
                            example: {
                                name: "Chhatrapati Shivaji Maharaj International Airport",
                                iataCode: "BOM",
                                city: "Mumbai",
                                country: "India",
                            },
                        },
                        stops: {
                            type: "array",
                            description: "Ordered list of ALL airports (departure + layovers + arrival). Minimum 2 (direct flight = source + destination only).",
                            items: { $ref: "#/components/schemas/FlightStopItem" },
                            example: [
                                { name: "Indira Gandhi International Airport", iataCode: "DEL", city: "Delhi", arrivalTime: "06:30", departureTime: "06:30", minutesFromSource: 0, order: 1 },
                                { name: "Chhatrapati Shivaji Maharaj International Airport", iataCode: "BOM", city: "Mumbai", arrivalTime: "08:45", departureTime: "08:45", minutesFromSource: 135, order: 2 },
                            ],
                        },
                        distanceInKm: { type: "number", example: 1150, description: "Total route distance in kilometres" },
                        estimatedDurationInMinutes: { type: "integer", example: 135, description: "Total flight time source → destination" },
                    },
                },

                FlightRouteResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Route created successfully." },
                        data: { type: "object" },
                    },
                },

                FlightRouteListResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        count: { type: "integer", example: 2 },
                        data: { type: "array", items: { type: "object" } },
                    },
                },

                // ── Flight Schedules ────────────────────────────────────

                CreateFlightScheduleRequest: {
                    type: "object",
                    required: ["routeId", "flightId", "flightNumber", "departureDate", "departureTime", "arrivalTime", "baseFare"],
                    properties: {
                        routeId: { type: "string", example: "682abc1234567890abcd5678" },
                        flightId: { type: "string", example: "682abc1234567890abcd1234" },
                        flightNumber: { type: "string", example: "6E-204" },
                        departureDate: { type: "string", example: "2026-07-10", description: "YYYY-MM-DD" },
                        arrivalDate: { type: "string", example: "2026-07-10", description: "YYYY-MM-DD. Optional — defaults to departureDate for same-day flights." },
                        departureTime: { type: "string", example: "06:30", description: "HH:mm 24-hour" },
                        arrivalTime: { type: "string", example: "08:45", description: "HH:mm 24-hour" },
                        baseFare: { type: "number", example: 4500, description: "Economy base fare in INR" },
                        departureTerminal: { type: "string", example: "Terminal 3", description: "Optional departure terminal" },
                        arrivalTerminal: { type: "string", example: "T2", description: "Optional arrival terminal" },
                        mealOptions: {
                            type: "array",
                            items: { type: "string", enum: ["VEG", "NON_VEG", "VEGAN", "JAIN", "DIABETIC"] },
                            example: ["VEG", "NON_VEG"],
                        },
                        cancellationPolicy: {
                            type: "array",
                            description: "Optional. Defaults to a 4-tier policy (75%/50%/25%/0%) if omitted.",
                            items: { $ref: "#/components/schemas/CancellationTier" },
                        },
                    },
                },

                FlightScheduleResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Schedule created successfully." },
                        data: { type: "object" },
                    },
                },

                // ── Flight Seat Layout ──────────────────────────────────

                FlightSeatLayoutResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Seat layout fetched successfully." },
                        data: {
                            type: "object",
                            properties: {
                                scheduleId: { type: "string", example: "682abc1234567890abcd9999" },
                                flight: {
                                    type: "object",
                                    properties: {
                                        airlineName: { type: "string", example: "IndiGo" },
                                        flightNumber: { type: "string", example: "6E-204" },
                                        aircraftType: { type: "string", example: "AIRBUS_A320" },
                                        amenities: { type: "array", items: { type: "string" } },
                                        averageRating: { type: "number", example: 4.2 },
                                    },
                                },
                                route: {
                                    type: "object",
                                    properties: {
                                        source: { $ref: "#/components/schemas/AirportItem" },
                                        destination: { $ref: "#/components/schemas/AirportItem" },
                                        distanceInKm: { type: "number", example: 1150 },
                                        estimatedDurationInMinutes: { type: "integer", example: 135 },
                                    },
                                },
                                departureDate: { type: "string", format: "date-time" },
                                departureTime: { type: "string", example: "06:30" },
                                arrivalTime: { type: "string", example: "08:45" },
                                departureTerminal: { type: "string", example: "Terminal 3" },
                                arrivalTerminal: { type: "string", example: "T2" },
                                baseFare: { type: "number", example: 4500 },
                                availableSeats: { type: "integer", example: 165 },
                                totalSeats: { type: "integer", example: 180 },
                                seats: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            seatNumber: { type: "string", example: "3A" },
                                            cabinClass: { type: "string", enum: ["ECONOMY", "BUSINESS", "FIRST"], example: "ECONOMY" },
                                            seatType: { type: "string", enum: ["window", "aisle", "middle"], example: "window" },
                                            row: { type: "integer", example: 3 },
                                            column: { type: "string", example: "A" },
                                            isExtraLegroom: { type: "boolean", example: false },
                                            fare: { type: "number", example: 4500 },
                                            status: { type: "string", enum: ["AVAILABLE", "BOOKED", "BLOCKED"], example: "AVAILABLE" },
                                            passengerName: { type: "string", nullable: true },
                                        },
                                    },
                                },
                                mealOptions: { type: "array", items: { type: "string" }, example: ["VEG", "NON_VEG"] },
                                cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                                status: { type: "string", example: "SCHEDULED" },
                            },
                        },
                    },
                },

                // ── Flight Search ───────────────────────────────────────

                FlightSearchResultResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Found 4 flight(s) from DEL to BOM." },
                        count: { type: "integer", example: 4 },
                        data: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    scheduleId: { type: "string", example: "682abc1234567890abcd9999" },
                                    operator: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            name: { type: "string", example: "IndiGo Airlines" },
                                        },
                                    },
                                    flight: {
                                        type: "object",
                                        properties: {
                                            id: { type: "string" },
                                            airlineName: { type: "string", example: "IndiGo" },
                                            flightNumber: { type: "string", example: "6E-204" },
                                            aircraftType: { type: "string", example: "AIRBUS_A320" },
                                            classType: { type: "string", example: "ECONOMY" },
                                            hasBusinessClass: { type: "boolean", example: false },
                                            amenities: { type: "array", items: { type: "string" }, example: ["Meal", "USB Charging"] },
                                            rating: { type: "number", example: 4.2 },
                                        },
                                    },
                                    journey: {
                                        type: "object",
                                        properties: {
                                            departureDate: { type: "string", format: "date-time" },
                                            arrivalDate: { type: "string", format: "date-time" },
                                            departureTime: { type: "string", example: "06:30" },
                                            arrivalTime: { type: "string", example: "08:45" },
                                            durationMinutes: { type: "integer", example: 135 },
                                            source: { type: "string", example: "Delhi (DEL)" },
                                            destination: { type: "string", example: "Mumbai (BOM)" },
                                            departureTerminal: { type: "string", example: "Terminal 3", nullable: true },
                                            arrivalTerminal: { type: "string", example: "T2", nullable: true },
                                        },
                                    },
                                    pricing: {
                                        type: "object",
                                        properties: {
                                            baseFare: { type: "number", example: 4500 },
                                        },
                                    },
                                    seats: {
                                        type: "object",
                                        properties: {
                                            available: { type: "integer", example: 165 },
                                            total: { type: "integer", example: 180 },
                                        },
                                    },
                                    mealOptions: { type: "array", items: { type: "string" }, example: ["VEG", "NON_VEG"] },
                                    cancellationPolicy: { type: "array", items: { $ref: "#/components/schemas/CancellationTier" } },
                                    status: { type: "string", example: "SCHEDULED" },
                                },
                            },
                        },
                    },
                },

                // ── Vendor Dashboard ────────────────────────────────────

                VendorDashboardResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean", example: true },
                        message: { type: "string", example: "Dashboard summary fetched successfully." },
                        data: {
                            type: "object",
                            properties: {
                                buses: {
                                    type: "object",
                                    properties: {
                                        total:    { type: "integer", example: 4 },
                                        active:   { type: "integer", example: 3 },
                                        inactive: { type: "integer", example: 1 },
                                    },
                                },
                                flights: {
                                    type: "object",
                                    properties: {
                                        total:    { type: "integer", example: 2 },
                                        active:   { type: "integer", example: 2 },
                                        inactive: { type: "integer", example: 0 },
                                    },
                                },
                                schedules: {
                                    type: "object",
                                    properties: {
                                        upcomingBus:    { type: "integer", example: 8 },
                                        upcomingFlight: { type: "integer", example: 4 },
                                        totalUpcoming:  { type: "integer", example: 12 },
                                    },
                                },
                                bookings: {
                                    type: "object",
                                    properties: {
                                        confirmed: { type: "integer", example: 87 },
                                    },
                                },
                                 revenue: {
                                    type: "object",
                                    properties: {
                                        total: { type: "number", example: 142500.00, description: "Total revenue from CONFIRMED bookings in INR" },
                                    },
                                },
                            },
                        },
                    },
                },

                // ─────────────────────────────────────────────────────────
                // HOTELS MODULE
                // ─────────────────────────────────────────────────────────

                HotelItem: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        operatorId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        name: { type: "string", example: "Taj Coromandel" },
                        description: { type: "string", example: "Luxury 5-star hotel in Chennai." },
                        address: { type: "string", example: "37, Mahatma Gandhi Rd, Nungambakkam" },
                        city: { type: "string", example: "Chennai" },
                        state: { type: "string", example: "Tamil Nadu" },
                        country: { type: "string", example: "India" },
                        starRating: { type: "integer", example: 5 },
                        amenities: { type: "array", items: { type: "string" }, example: ["WiFi", "Pool"] },
                        checkInTime: { type: "string", example: "14:00" },
                        checkOutTime: { type: "string", example: "11:00" },
                        status: { type: "string", example: "ACTIVE" },
                        startingPrice: { type: "number", example: 5000, description: "Only available in search responses" },
                    },
                },

                RoomItem: {
                    type: "object",
                    properties: {
                        _id: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        hotelId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        roomType: { type: "string", example: "Deluxe King Room" },
                        description: { type: "string", example: "Spacious room with city view." },
                        pricePerNight: { type: "number", example: 5000 },
                        capacity: {
                            type: "object",
                            properties: {
                                adults: { type: "integer", example: 2 },
                                children: { type: "integer", example: 1 },
                            },
                        },
                        totalRooms: { type: "integer", example: 10 },
                        amenities: { type: "array", items: { type: "string" }, example: ["AC", "TV"] },
                        bedType: { type: "string", example: "King" },
                        status: { type: "string", example: "AVAILABLE" },
                    },
                },

                CreateHotelRequest: {
                    type: "object",
                    required: ["name", "description", "address", "city", "state", "starRating"],
                    properties: {
                        name: { type: "string", example: "Taj Coromandel" },
                        description: { type: "string", example: "Luxury 5-star hotel in Chennai." },
                        address: { type: "string", example: "37, Mahatma Gandhi Rd, Nungambakkam" },
                        city: { type: "string", example: "Chennai" },
                        state: { type: "string", example: "Tamil Nadu" },
                        starRating: { type: "integer", example: 5 },
                        amenities: { type: "array", items: { type: "string" }, example: ["WiFi", "Pool"] },
                        images: {
                            type: "array",
                            items: { type: "string", format: "binary" },
                            description: "Upload up to 10 image files"
                        },
                    },
                },

                CreateRoomRequest: {
                    type: "object",
                    required: ["roomType", "description", "pricePerNight", "capacity", "totalRooms", "bedType"],
                    properties: {
                        roomType: { type: "string", example: "Deluxe King Room" },
                        description: { type: "string", example: "Spacious room with city view." },
                        pricePerNight: { type: "number", example: 5000 },
                        capacity: {
                            type: "object",
                            properties: {
                                adults: { type: "integer", example: 2 },
                                children: { type: "integer", example: 1 },
                            },
                        },
                        totalRooms: { type: "integer", example: 10 },
                        bedType: { type: "string", example: "King" },
                        amenities: { type: "array", items: { type: "string" }, example: ["AC", "TV"] },
                    },
                },

                CreateHotelBookingRequest: {
                    type: "object",
                    required: ["hotelId", "roomId", "checkInDate", "checkOutDate", "numRooms", "totalGuests", "guestDetails"],
                    properties: {
                        hotelId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        roomId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0e" },
                        checkInDate: { type: "string", format: "date", example: "2026-07-10" },
                        checkOutDate: { type: "string", format: "date", example: "2026-07-12" },
                        numRooms: { type: "integer", example: 1 },
                        totalGuests: {
                            type: "object",
                            properties: {
                                adults: { type: "integer", example: 2 },
                                children: { type: "integer", example: 0 },
                            },
                        },
                        guestDetails: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string", example: "John Doe" },
                                    age: { type: "integer", example: 30 },
                                },
                            },
                        },
                    },
                },

                CreateHotelReviewRequest: {
                    type: "object",
                    required: ["bookingId", "rating", "comment"],
                    properties: {
                        bookingId: { type: "string", example: "665f1a2b3c4d5e6f7a8b9c0d" },
                        rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
                        comment: { type: "string", example: "Amazing stay, highly recommended!" },
                    },
                },

            }, // ← closes schemas — DO NOT REMOVE

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
