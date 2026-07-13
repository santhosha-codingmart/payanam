import User from "../models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { Bus } from "../../bus/models/bus.model.js";
import { Schedule } from "../../bus/models/schedule.model.js";
import { Aircraft as Flight } from "../../flights/models/aircraft.model.js";
import { FlightSchedule } from "../../flights/models/flightSchedule.model.js";
import Booking from "../../bookings/models/booking.model.js";

export const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  return user;
};

export const updateUserProfile = async (userId, updateData, userRole) => {
  const { name, age, email, phoneNo, companyName, gstNumber } = updateData;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  if (email && email !== user.email) {
    const emailExists = await User.findOne({
      email,
    });
    if (emailExists) {
      throw new ApiError(
        409,
        "This email is already registered to another account.",
      );
    }
    user.email = email;
  }
  if (phoneNo && phoneNo !== user.phoneNo) {
    const phoneExists = await User.findOne({
      phoneNo,
    });
    if (phoneExists) {
      throw new ApiError(
        409,
        "This phone number is already registered to another account.",
      );
    }
    user.phoneNo = phoneNo;
  }
  if (name !== undefined) user.name = name;
  if (age !== undefined) user.age = age;
  if (userRole === "vendor") {
    if (companyName !== undefined) user.companyName = companyName;
    if (gstNumber !== undefined) user.gstNumber = gstNumber;
  }
  await user.save();
  const updatedUser = user.toObject();
  delete updatedUser.password;
  return updatedUser;
};

export const getVendorDashboardService = async (operatorId) => {
  const now = new Date();
  const [
    totalBuses,
    activeBuses,
    totalFlights,
    activeFlights,
    upcomingBusSchedules,
    upcomingFlightSchedules,
    bookingStats,
  ] = await Promise.all([
    Bus.countDocuments({
      operatorId,
    }),
    Bus.countDocuments({
      operatorId,
      status: "ACTIVE",
    }),
    Flight.countDocuments({
      operatorId,
    }),
    Flight.countDocuments({
      operatorId,
      status: "ACTIVE",
    }),
    Schedule.countDocuments({
      operatorId,
      status: "SCHEDULED",
      departureDate: {
        $gte: now,
      },
    }),
    FlightSchedule.countDocuments({
      operatorId,
      status: "SCHEDULED",
      departureDate: {
        $gte: now,
      },
    }),
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
          totalBookings: {
            $sum: 1,
          },
          totalRevenue: {
            $sum: "$totalFare",
          },
        },
      },
    ]),
  ]);
  const { totalBookings = 0, totalRevenue = 0 } = bookingStats[0] || {};
  return {
    buses: {
      total: totalBuses,
      active: activeBuses,
      inactive: totalBuses - activeBuses,
    },
    flights: {
      total: totalFlights,
      active: activeFlights,
      inactive: totalFlights - activeFlights,
    },
    schedules: {
      upcomingBus: upcomingBusSchedules,
      upcomingFlight: upcomingFlightSchedules,
      totalUpcoming: upcomingBusSchedules + upcomingFlightSchedules,
    },
    bookings: {
      confirmed: totalBookings,
    },
    revenue: {
      total: Math.round(totalRevenue * 100) / 100,
    },
  };
};

export const requestVendorReapproval = async (vendorId) => {
  const vendor = await User.findById(vendorId);
  if (!vendor) {
    throw new ApiError(404, "Vendor not found.");
  }
  if (vendor.role !== "vendor") {
    throw new ApiError(400, "This user is not a vendor.");
  }
  if (vendor.vendorApprovalStatus !== "REJECTED") {
    throw new ApiError(400, "Only rejected vendors can request re-approval.");
  }
  vendor.vendorApprovalStatus = "PENDING";
  vendor.rejectionReason = "";
  await vendor.save();
  return {
    vendorId: vendor._id,
    name: vendor.name,
    email: vendor.email,
    vendorApprovalStatus: vendor.vendorApprovalStatus,
    message: "Your re-approval request has been submitted. Please wait for admin review.",
  };
};
