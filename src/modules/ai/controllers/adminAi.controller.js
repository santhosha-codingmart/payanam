import dotenv from "dotenv";
import User from "../../users/models/user.model.js";
import { Bus } from "../../bus/models/bus.model.js";
import { Aircraft } from "../../flights/models/aircraft.model.js";
import Booking from "../../bookings/models/booking.model.js";

dotenv.config();

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * Gather platform data to provide context to the AI
 */
const gatherPlatformData = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
        totalUsers,
        totalVendors,
        pendingVendors,
        totalBuses,
        activeBuses,
        totalFlights,
        activeFlights,
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        thisMonthBookings,
        revenueAgg,
        monthlyRevenueAgg,
        busRevenueAgg,
        flightRevenueAgg,
        busBookingsCount,
        flightBookingsCount,
        recentUsers,
        recentVendors,
        recentBookings,
        bannedUsers,
    ] = await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "vendor" }),
        User.countDocuments({ role: "vendor", vendorApprovalStatus: "PENDING" }),
        Bus.countDocuments(),
        Bus.countDocuments({ status: "ACTIVE" }),
        Aircraft.countDocuments(),
        Aircraft.countDocuments({ status: "ACTIVE" }),
        Booking.countDocuments(),
        Booking.countDocuments({ bookingStatus: "CONFIRMED" }),
        Booking.countDocuments({ bookingStatus: "CANCELLED" }),
        Booking.countDocuments({
            bookingStatus: "CONFIRMED",
            bookedAt: { $gte: startOfMonth },
        }),
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED" } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED", bookedAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
        // Bus revenue (bookingId starts with PAY-)
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED", bookingId: /^PAY-/ } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
        // Flight revenue (bookingId starts with FLY-)
        Booking.aggregate([
            { $match: { bookingStatus: "CONFIRMED", bookingId: /^FLY-/ } },
            { $group: { _id: null, total: { $sum: "$totalFare" } } },
        ]),
        // Bus bookings count
        Booking.countDocuments({ bookingId: /^PAY-/ }),
        // Flight bookings count
        Booking.countDocuments({ bookingId: /^FLY-/ }),
        User.find({ role: "user" }).select("name email createdAt").sort({ createdAt: -1 }).limit(5),
        User.find({ role: "vendor" }).select("name email companyName vendorApprovalStatus createdAt").sort({ createdAt: -1 }).limit(5),
        Booking.find().select("bookingId userId bookingStatus totalFare createdAt").sort({ createdAt: -1 }).limit(5).populate("userId", "name email"),
        User.countDocuments({ role: { $in: ["user", "vendor"] }, isActive: false }),
    ]);

    return {
        overview: {
            totalUsers,
            totalVendors,
            pendingVendorApprovals: pendingVendors,
            bannedUsers,
            totalBuses,
            activeBuses,
            inactiveBuses: totalBuses - activeBuses,
            totalFlights,
            activeFlights,
            inactiveFlights: totalFlights - activeFlights,
        },
        bookings: {
            total: totalBookings,
            confirmed: confirmedBookings,
            cancelled: cancelledBookings,
            thisMonth: thisMonthBookings,
            byService: {
                bus: { total: busBookingsCount, percentage: totalBookings > 0 ? Math.round((busBookingsCount / totalBookings) * 100) : 0 },
                flight: { total: flightBookingsCount, percentage: totalBookings > 0 ? Math.round((flightBookingsCount / totalBookings) * 100) : 0 },
            },
        },
        revenue: {
            total: revenueAgg[0]?.total || 0,
            thisMonth: monthlyRevenueAgg[0]?.total || 0,
            byService: {
                bus: busRevenueAgg[0]?.total || 0,
                flight: flightRevenueAgg[0]?.total || 0,
            },
            currency: "INR",
        },
        recentUsers: recentUsers.map(u => ({
            name: u.name || "N/A",
            email: u.email,
            joinedAt: u.createdAt,
        })),
        recentVendors: recentVendors.map(v => ({
            name: v.name || "N/A",
            email: v.email,
            company: v.companyName || "N/A",
            status: v.vendorApprovalStatus,
            joinedAt: v.createdAt,
        })),
        recentBookings: recentBookings.map(b => ({
            bookingId: b.bookingId,
            user: b.userId?.name || b.userId?.email || "Unknown",
            status: b.bookingStatus,
            amount: b.totalFare,
            date: b.createdAt,
        })),
    };
};

/**
 * Admin AI Chat Controller
 * Answers questions about vendors, users, bookings, revenue, etc.
 */
export const adminAiChatController = async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== "string") {
            return res.status(400).json({ success: false, error: "message is required" });
        }

        if (!process.env.NVIDIA_API_KEY) {
            return res.status(500).json({ success: false, error: "NVIDIA_API_KEY not configured" });
        }

        // Gather platform data for context
        let platformData;
        try {
            platformData = await gatherPlatformData();
        } catch (dbError) {
            console.error("Error gathering platform data:", dbError);
            platformData = {
                overview: { totalUsers: 0, totalVendors: 0, pendingVendorApprovals: 0, bannedUsers: 0, totalBuses: 0, activeBuses: 0, inactiveBuses: 0, totalFlights: 0, activeFlights: 0, inactiveFlights: 0 },
                bookings: { total: 0, confirmed: 0, cancelled: 0, thisMonth: 0, byService: { bus: { total: 0, percentage: 0 }, flight: { total: 0, percentage: 0 } } },
                revenue: { total: 0, thisMonth: 0, byService: { bus: 0, flight: 0 }, currency: "INR" },
                recentUsers: [],
                recentVendors: [],
                recentBookings: [],
            };
        }

        const systemPrompt = `You are an AI assistant for the Payanam travel booking platform admin dashboard.
You have access to the following real-time platform data:

${JSON.stringify(platformData, null, 2)}

Your role:
- Answer questions about users, vendors, bookings, revenue, buses, flights, and platform statistics.
- Provide insights and summaries based on the data.
- Help admins understand platform performance.
- You can compare bus vs flight performance using the byService breakdowns.
- Be concise and helpful.
- Format currency in Indian Rupees (₹).
- If asked about specific users/vendors not in the recent lists, mention that you can only see the most recent 5.
- Do not make up data that isn't provided above.
- Be professional but friendly.

Example questions you can answer:
- "How many users do we have?"
- "What's the total revenue?"
- "Show me recent bookings"
- "How many vendors are pending approval?"
- "What's the bus fleet status?"
- "What's the flight fleet status?"
- "Compare bus vs flight revenue"
- "Which service has more bookings?"
- "Compare this month's performance"`;

        const response = await fetch(NVIDIA_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
                Accept: "application/json",
            },
            body: JSON.stringify({
                model: "meta/llama-3.1-8b-instruct",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                temperature: 0.5,
                top_p: 0.8,
                max_tokens: 2048,
                stream: false,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("NVIDIA API error:", response.status, errText);
            return res.status(response.status).json({
                success: false,
                error: `NVIDIA API error: ${response.status}`,
                details: errText,
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";

        return res.status(200).json({ 
            success: true, 
            content,
            context: {
                timestamp: new Date().toISOString(),
                dataSummary: {
                    users: platformData.overview.totalUsers,
                    vendors: platformData.overview.totalVendors,
                    bookings: platformData.bookings.total,
                }
            }
        });
    } catch (error) {
        console.error("Admin AI chat controller error:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Internal server error",
            details: error.message 
        });
    }
};
