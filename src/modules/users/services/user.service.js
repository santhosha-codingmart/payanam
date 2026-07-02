import User from "../models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { Bus } from "../../bus/models/bus.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import { Aircraft as Flight } from "../../flights/models/aircraft.model.js";
import { FlightSchedule } from "../../flights/models/flightSchedule.model.js";
import Booking from "../../bookings/models/booking.model.js";

/**
 * Get the full profile for a given user ID.
 * Password is excluded from the returned document.
 *
 * @param {string} userId - The MongoDB ObjectId of the user
 * @returns {object} The user document (without password)
 */
export const getUserProfile = async (userId) => {
    const user = await User.findById(userId).select("-password");

    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    return user;
};

/**
 * Update the profile fields for a given user.
 *
 * Allows updating: name, age, email, phoneNo (all users)
 *                  companyName, gstNumber       (vendors only — silently ignored for other roles)
 *
 * Role, password, and verification flags cannot be changed through this endpoint.
 *
 * @param {string} userId     - The MongoDB ObjectId of the user
 * @param {object} updateData - The fields to update
 * @param {string} userRole   - The role of the calling user ("user" / "vendor" / "admin")
 * @returns {object} The updated user document (without password)
 */
export const updateUserProfile = async (userId, updateData, userRole) => {
    const { name, age, email, phoneNo, companyName, gstNumber } = updateData;

    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    // ── Check for email uniqueness (if they're changing it) ──────────────
    if (email && email !== user.email) {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            throw new ApiError(409, "This email is already registered to another account.");
        }
        user.email = email;
    }

    // ── Check for phone uniqueness (if they're changing it) ──────────────
    if (phoneNo && phoneNo !== user.phoneNo) {
        const phoneExists = await User.findOne({ phoneNo });
        if (phoneExists) {
            throw new ApiError(409, "This phone number is already registered to another account.");
        }
        user.phoneNo = phoneNo;
    }

    // ── Update simple fields (only if provided) ─────────────────────────
    if (name !== undefined) user.name = name;
    if (age  !== undefined) user.age  = age;

    // ── Vendor-only fields ───────────────────────────────────────────────
    // Only apply if the caller is actually a vendor.
    // A regular user sending these fields has them silently ignored.
    if (userRole === "vendor") {
        if (companyName !== undefined) user.companyName = companyName;
        if (gstNumber   !== undefined) user.gstNumber   = gstNumber;
    }

    await user.save();

    // Return the user without the password field
    const updatedUser = user.toObject();
    delete updatedUser.password;

    return updatedUser;
};

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR DASHBOARD SUMMARY
// Returns aggregated stats in a single call so the frontend doesn't need to
// fire 5 separate requests on dashboard load.
//
// All DB queries run in PARALLEL via Promise.all — total latency equals the
// slowest single query rather than the sum of all of them.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the vendor dashboard summary for the given operatorId.
 *
 * @param {string} operatorId - The vendor's MongoDB _id (from req.user._id)
 * @returns {object} Dashboard summary object
 */
export const getVendorDashboardService = async (operatorId) => {
    const now = new Date();

    // ── Run all queries in parallel ───────────────────────────────────────
    // Promise.all fires all queries at the same time and waits for ALL to finish.
    // This is much faster than awaiting them one by one.
    const [
        totalBuses,
        activeBuses,
        totalFlights,
        activeFlights,
        upcomingBusSchedules,
        upcomingFlightSchedules,
        bookingStats,
    ] = await Promise.all([
        // 1. Total number of buses this vendor owns
        Bus.countDocuments({ operatorId }),

        // 2. Buses that are currently ACTIVE (not under maintenance or inactive)
        Bus.countDocuments({ operatorId, status: "ACTIVE" }),

        // 3. Total number of aircraft this vendor owns
        Flight.countDocuments({ operatorId }),

        // 4. Aircraft that are currently ACTIVE
        Flight.countDocuments({ operatorId, status: "ACTIVE" }),

        // 5. Upcoming SCHEDULED bus trips (departure date in the future)
        Schedule.countDocuments({
            operatorId,
            status: "SCHEDULED",
            departureDate: { $gte: now },
        }),

        // 6. Upcoming SCHEDULED flight trips (departure date in the future)
        FlightSchedule.countDocuments({
            operatorId,
            status: "SCHEDULED",
            departureDate: { $gte: now },
        }),

        // 7. Booking aggregation — count and revenue from CONFIRMED bookings only.
        //    We link bookings to this vendor via the scheduleId → operatorId chain.
        //    $group with _id: null collapses all matching docs into a single result.
        Booking.aggregate([
            {
                $match: {
                    operatorId,
                    bookingStatus: "CONFIRMED",
                },
            },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },           // Count of confirmed bookings
                    totalRevenue:  { $sum: "$totalFare" }, // Sum of all fares collected
                },
            },
        ]),
    ]);

    // bookingStats is an array. If no bookings exist yet, it's [].
    // We safely destructure with a default fallback object.
    const { totalBookings = 0, totalRevenue = 0 } = bookingStats[0] || {};

    // ── Shape the response ─────────────────────────────────────────────────
    return {
        buses: {
            total:       totalBuses,
            active:      activeBuses,
            inactive:    totalBuses - activeBuses,
        },
        flights: {
            total:       totalFlights,
            active:      activeFlights,
            inactive:    totalFlights - activeFlights,
        },
        schedules: {
            upcomingBus:    upcomingBusSchedules,
            upcomingFlight: upcomingFlightSchedules,
            totalUpcoming:  upcomingBusSchedules + upcomingFlightSchedules,
        },
        bookings: {
            confirmed: totalBookings,
        },
        revenue: {
            // Round to 2 decimal places for clean currency display
            total: Math.round(totalRevenue * 100) / 100,
        },
    };
};
