# 🚀 Payanam — MakeMyTrip Clone (Backend)

> REST API backend for a travel booking platform with **Bus**, **Train**, and **Flight** modules.

---

## 📋 Project Analysis

### Current State

| Layer | Status | Details |
|-------|--------|---------|
| **Auth Module** | ✅ Complete | Email register/login, JWT (access + refresh), forgot/reset password via email OTP, mobile OTP via Twilio |
| **User Model** | ✅ Complete | Name, age, email, phoneNo, role (`user`/`vendor`/`admin`), verification flags |
| **Infrastructure** | ✅ Complete | MongoDB, Redis, Swagger docs, Zod validation, global error handler, `ApiError` class |
| **Bus Module** | 🔴 Empty | Directory scaffold only |
| **Train Module** | 🔴 Empty | Directory scaffold only |
| **Flight Module** | 🔴 Empty | Directory scaffold only |
| **Bookings Module** | 🔴 Empty | Directory scaffold only |
| **Payments Module** | 🔴 Empty | Directory scaffold only |

### Tech Stack

- **Runtime:** Node.js (ES Modules)
- **Framework:** Express 5
- **Database:** MongoDB + Mongoose 9
- **Cache/OTP Store:** Redis (ioredis)
- **Auth:** JWT (access/refresh in HTTP-only cookies), bcrypt
- **Validation:** Zod 4
- **API Docs:** Swagger (swagger-jsdoc + swagger-ui-express)

### Architecture Pattern

```
src/modules/<module>/
├── controllers/   ← Handle req/res, delegate to services
├── models/        ← Mongoose schemas
├── routes/        ← Express routers + Swagger JSDoc
├── services/      ← Business logic
└── validators/    ← Zod schemas (used by validate middleware)
```

---

## 🗓️ 7-Day Development Plan (Backend Only)

### Day 1 — Auth Hardening & User Profile

**Goal:** Lock down existing auth, add missing middleware, build user profile APIs.

| # | Task | Details |
|---|------|---------|
| 1.1 | Create `auth.middleware.js` | Verify `accessToken` cookie, attach `req.user` |
| 1.2 | Create `role.middleware.js` | Restrict routes by role (`user`, `vendor`, `admin`) |
| 1.3 | Add `logout` endpoint | Clear cookies + delete refresh token from DB |
| 1.4 | Add `GET /api/users/profile` | Return logged-in user's profile |
| 1.5 | Add `PUT /api/users/profile` | Update name, age, email, phone |
| 1.6 | Fix `.gitignore` | Add `node_modules` |

**Files:**
```
src/middleware/auth.middleware.js              ← NEW
src/middleware/role.middleware.js              ← NEW
src/modules/users/controllers/user.controller.js  ← NEW
src/modules/users/services/user.service.js        ← NEW
src/modules/users/routes/user.routes.js            ← NEW
src/modules/users/validators/user.validator.js     ← NEW
```

---

### Day 2 — Bus Module 🚌

**Goal:** Full CRUD for bus operators (vendors) + public search.

#### Models

| Model | Key Fields |
|-------|-----------|
| `Bus` | `operatorId` (ref User), `busName`, `busType` (AC-Sleeper / AC-Seater / Non-AC-Sleeper / Non-AC-Seater), `totalSeats`, `amenities[]`, `registrationNumber`, `seatLayout[]` |
| `BusRoute` | `busId`, `source`, `destination`, `stops[]` ({ city, arrivalTime, departureTime }), `distance`, `duration` |
| `BusSchedule` | `routeId`, `busId`, `departureDate`, `departureTime`, `arrivalTime`, `baseFare`, `availableSeats`, `status` |

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/buses` | vendor | Add a new bus |
| GET | `/api/buses` | vendor | List vendor's own buses |
| PUT | `/api/buses/:id` | vendor | Update bus details |
| DELETE | `/api/buses/:id` | vendor | Remove a bus |
| POST | `/api/buses/routes` | vendor | Create a bus route |
| POST | `/api/buses/schedules` | vendor | Create a schedule for a route |
| GET | `/api/buses/search?from=&to=&date=` | public | Search available buses |
| GET | `/api/buses/schedules/:scheduleId/seats` | user | View seat layout + availability |

#### Tasks

| # | Task |
|---|------|
| 2.1 | Create `Bus`, `BusRoute`, `BusSchedule` models with indexes |
| 2.2 | Create Zod validators for all endpoints |
| 2.3 | Build bus service layer (CRUD + search logic) |
| 2.4 | Build bus controllers |
| 2.5 | Define routes with Swagger annotations |
| 2.6 | Register `busRouter` in `app.js` |

---

### Day 3 — Train Module 🚆

**Goal:** Admin-managed trains with search + class-wise availability.

#### Models

| Model | Key Fields |
|-------|-----------|
| `Train` | `trainNumber`, `trainName`, `trainType` (Express / Superfast / Rajdhani / Shatabdi / Duronto), `totalCoaches` |
| `TrainRoute` | `trainId`, `source`, `destination`, `stops[]` ({ station, arrivalTime, departureTime, day, distanceKm }), `runningDays[]` |
| `TrainSchedule` | `routeId`, `trainId`, `journeyDate`, `classes[]` ({ classType, fare, totalSeats, availableSeats }) |

Class types: `SL` (Sleeper), `3A`, `2A`, `1A`, `CC` (Chair Car), `2S` (Second Sitting)

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/trains` | admin | Add a train |
| GET | `/api/trains` | admin | List all trains |
| PUT | `/api/trains/:id` | admin | Update train details |
| DELETE | `/api/trains/:id` | admin | Remove a train |
| POST | `/api/trains/routes` | admin | Define route with stops |
| POST | `/api/trains/schedules` | admin | Generate schedule for a date |
| GET | `/api/trains/search?from=&to=&date=` | public | Search trains between stations |
| GET | `/api/trains/schedules/:scheduleId/availability` | user | Class-wise seat availability |

#### Tasks

| # | Task |
|---|------|
| 3.1 | Create `Train`, `TrainRoute`, `TrainSchedule` models |
| 3.2 | Create Zod validators |
| 3.3 | Build train services (CRUD + search + availability) |
| 3.4 | Build train controllers |
| 3.5 | Define routes with Swagger docs |
| 3.6 | Register `trainRouter` in `app.js` |

---

### Day 4 — Flight Module ✈️

**Goal:** Admin-managed flights with search + fare classes.

#### Models

| Model | Key Fields |
|-------|-----------|
| `Flight` | `airlineCode`, `airlineName`, `flightNumber`, `aircraftType` |
| `FlightRoute` | `flightId`, `origin` (IATA code), `destination`, `departureTime`, `arrivalTime`, `duration`, `operatingDays[]` |
| `FlightSchedule` | `routeId`, `flightId`, `date`, `classes[]` ({ classType, fare, seatsAvailable }), `status` (scheduled / delayed / cancelled) |

Class types: `economy`, `premium-economy`, `business`, `first`

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/flights` | admin | Add a flight |
| GET | `/api/flights` | admin | List all flights |
| PUT | `/api/flights/:id` | admin | Update flight |
| DELETE | `/api/flights/:id` | admin | Remove flight |
| POST | `/api/flights/routes` | admin | Define flight route |
| POST | `/api/flights/schedules` | admin | Generate schedule |
| GET | `/api/flights/search?from=&to=&date=&class=` | public | Search flights |
| GET | `/api/flights/schedules/:scheduleId/seats` | user | View seat availability by class |

#### Tasks

| # | Task |
|---|------|
| 4.1 | Create `Flight`, `FlightRoute`, `FlightSchedule` models |
| 4.2 | Create Zod validators |
| 4.3 | Build flight services (CRUD + search + pricing) |
| 4.4 | Build flight controllers |
| 4.5 | Define routes with Swagger docs |
| 4.6 | Register `flightRouter` in `app.js` |

---

### Day 5 — Unified Booking System 💳

**Goal:** One booking engine that handles all three transport types.

#### Models

| Model | Key Fields |
|-------|-----------|
| `Booking` | `userId`, `bookingType` (bus/train/flight), `scheduleId` (ObjectId), `passengers[]` ({ name, age, gender, seatNo }), `status` (pending/confirmed/cancelled), `totalAmount`, `paymentId`, `pnr`, `contactEmail`, `contactPhone` |
| `Payment` | `bookingId`, `userId`, `amount`, `method` (card/upi/netbanking), `transactionId`, `status` (pending/success/failed/refunded) |

#### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bookings` | user | Create booking (hold seats) |
| GET | `/api/bookings` | user | List my bookings (paginated) |
| GET | `/api/bookings/:id` | user | Booking details by ID |
| GET | `/api/bookings/pnr/:pnr` | user | Lookup by PNR |
| PUT | `/api/bookings/:id/cancel` | user | Cancel booking + release seats |
| POST | `/api/payments/initiate` | user | Start payment (mock/Razorpay) |
| POST | `/api/payments/confirm` | user | Confirm payment + update booking status |
| GET | `/api/payments/:bookingId` | user | Payment status |

#### Tasks

| # | Task |
|---|------|
| 5.1 | Create `Booking` and `Payment` models |
| 5.2 | Build PNR generator utility (`utils/pnr.js`) |
| 5.3 | Build booking service — create, list, cancel (with seat rollback logic) |
| 5.4 | Build payment service — mock payment flow (simulate success/failure) |
| 5.5 | Build controllers for both |
| 5.6 | Define routes with Swagger docs |
| 5.7 | Register both routers in `app.js` |

---

### Day 6 — Seed Data, Notifications & Admin APIs 📊

**Goal:** Make the API usable with realistic data, add email/SMS confirmations, admin overview.

| # | Task | Details |
|---|------|---------|
| 6.1 | Seed script for buses | 10+ buses, routes (Chennai↔Bangalore, Mumbai↔Pune, etc.), schedules |
| 6.2 | Seed script for trains | 10+ trains with Indian railway stations and realistic stops |
| 6.3 | Seed script for flights | 10+ flights with IATA codes (MAA, BLR, BOM, DEL, etc.) |
| 6.4 | Booking confirmation email | Reuse existing `email.service.js` — send PNR + details |
| 6.5 | Booking confirmation SMS | Reuse existing `sms.service.js` — send PNR via Twilio |
| 6.6 | `GET /api/admin/bookings` | Admin — view all bookings with filters |
| 6.7 | `GET /api/admin/stats` | Admin — dashboard stats (total bookings, revenue, users) |
| 6.8 | Add `npm run seed` script | Wire up all seed files in `package.json` |

**Files:**
```
src/seeds/bus.seed.js         ← NEW
src/seeds/train.seed.js       ← NEW
src/seeds/flight.seed.js      ← NEW
src/seeds/index.js            ← NEW (runs all seeds)
src/modules/admin/            ← NEW module
```

---

### Day 7 — Testing, Docs & Cleanup 🧹

**Goal:** Ensure everything works, complete Swagger docs, handle edge cases.

| # | Task | Details |
|---|------|---------|
| 7.1 | End-to-end manual test | Test every endpoint via Swagger UI |
| 7.2 | Complete Swagger schemas | Add missing request/response schemas to `swagger.js` |
| 7.3 | Add search filters | Sort by price/duration, filter by bus type/train class/airline |
| 7.4 | Edge case handling | Double-booking prevention, cancellation after payment, expired schedules |
| 7.5 | Add `helmet` + `express-rate-limit` | Security hardening |
| 7.6 | API response standardization | Ensure all responses follow `{ success, message, data }` format |
| 7.7 | Final README update | API documentation with all endpoints listed |
| 7.8 | Postman collection export | Export from Swagger for frontend team |

---

## 📅 Week At a Glance

```
┌──────────┬──────────────────────────────────────┬────────────────────┐
│   Day    │ Focus                                │ Deliverable        │
├──────────┼──────────────────────────────────────┼────────────────────┤
│  Day 1   │ Auth middleware + User profile APIs   │ Protected routes   │
│  Day 2   │ Bus module (CRUD + Search)            │ 8 endpoints        │
│  Day 3   │ Train module (CRUD + Search)          │ 8 endpoints        │
│  Day 4   │ Flight module (CRUD + Search)         │ 8 endpoints        │
│  Day 5   │ Booking + Payment system              │ 8 endpoints        │
│  Day 6   │ Seed data + Notifications + Admin     │ Usable demo        │
│  Day 7   │ Testing + Docs + Polish               │ Production-ready   │
└──────────┴──────────────────────────────────────┴────────────────────┘
```

**Total new endpoints: ~40+** (on top of the existing 6 auth endpoints)

---

## 🏃 Quick Start

```bash
# Prerequisites: Node.js 18+, MongoDB, Redis

cd backend && npm install

# Configure environment
# Edit .env with your MongoDB URI, Redis, JWT secrets, Twilio/SMTP credentials

# Run dev server
npm run dev            # Starts on http://localhost:3000

# Seed sample data (after Day 6)
npm run seed

# API Docs
# http://localhost:3000/api-docs
```

---

## 📁 Target Project Structure

```
backend/src/
├── config/
│   ├── db.js                    # ✅ MongoDB connection
│   ├── redis.js                 # ✅ Redis connection
│   └── swagger.js               # ✅ Swagger config
├── middleware/
│   ├── auth.middleware.js       # 🔴 Day 1
│   ├── role.middleware.js       # 🔴 Day 1
│   ├── error.middleware.js      # ✅ Done
│   └── validate.middleware.js   # ✅ Done
├── modules/
│   ├── auth/                    # ✅ Done
│   ├── users/                   # 🔴 Day 1 (profile APIs)
│   ├── buses/                   # 🔴 Day 2
│   │   ├── models/   (Bus, BusRoute, BusSchedule)
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── validators/
│   ├── trains/                  # 🔴 Day 3
│   │   ├── models/   (Train, TrainRoute, TrainSchedule)
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── validators/
│   ├── flights/                 # 🔴 Day 4
│   │   ├── models/   (Flight, FlightRoute, FlightSchedule)
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── validators/
│   ├── bookings/                # 🔴 Day 5
│   ├── payments/                # 🔴 Day 5
│   └── admin/                   # 🔴 Day 6
├── seeds/                       # 🔴 Day 6
├── utils/
│   ├── ApiError.js              # ✅ Done
│   ├── email.service.js         # ✅ Done
│   ├── sms.service.js           # ✅ Done
│   └── pnr.js                   # 🔴 Day 5
├── app.js                       # ✅ Done (will add new routers)
└── server.js                    # ✅ Done
```

---

*Payanam (பயணம்) means "Journey" in Tamil.*
