import { Bus } from "../models/bus.model.js";
import { Route } from "../models/route.model.js";
import { Schedule } from "../models/schedule.model.js";
import { ApiError } from "../../../utils/ApiError.js";

// ─────────────────────────────────────────────────────────────────────────────
// BUS CRUD (vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createBusService = async (operatorId, payload) => {
    // Check for duplicate registration number
    const existing = await Bus.findOne({
        registrationNumber: payload.registrationNumber.toUpperCase(),
    });
    if (existing) {
        throw new ApiError(409, "A bus with this registration number already exists.");
    }

    // Check for duplicate bus number
    const existingBusNum = await Bus.findOne({
        busNumber: payload.busNumber.toUpperCase(),
    });
    if (existingBusNum) {
        throw new ApiError(409, "A bus with this bus number already exists.");
    }

    const bus = await Bus.create({
        ...payload,
        operatorId,
        registrationNumber: payload.registrationNumber.toUpperCase(),
        busNumber: payload.busNumber.toUpperCase(),
    });

    return bus;
};

export const getVendorBusesService = async (operatorId) => {
    return await Bus.find({ operatorId }).sort({ createdAt: -1 });
};

export const getBusByIdService = async (busId) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    return bus;
};

export const updateBusService = async (busId, operatorId, updateData) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }

    // Ownership check — vendor can only update their own buses
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only update your own buses.");
    }

    // If registration number is being changed, check uniqueness
    if (updateData.registrationNumber) {
        updateData.registrationNumber = updateData.registrationNumber.toUpperCase();
        const duplicate = await Bus.findOne({
            registrationNumber: updateData.registrationNumber,
            _id: { $ne: busId },
        });
        if (duplicate) {
            throw new ApiError(409, "Another bus with this registration number already exists.");
        }
    }

    // If bus number is being changed, check uniqueness
    if (updateData.busNumber) {
        updateData.busNumber = updateData.busNumber.toUpperCase();
        const duplicate = await Bus.findOne({
            busNumber: updateData.busNumber,
            _id: { $ne: busId },
        });
        if (duplicate) {
            throw new ApiError(409, "Another bus with this bus number already exists.");
        }
    }

    Object.assign(bus, updateData);
    await bus.save();
    return bus;
};

export const deleteBusService = async (busId, operatorId) => {
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }

    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only delete your own buses.");
    }

    // Cascade delete: remove all schedules and routes for this bus
    await Schedule.deleteMany({ busId });
    await Route.deleteMany({ busId });
    await Bus.findByIdAndDelete(busId);

    return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE MANAGEMENT (vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createRouteService = async (operatorId, routeData) => {
    // Verify bus exists and belongs to this vendor
    const bus = await Bus.findById(routeData.busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create routes for your own buses.");
    }

    // Sort stops by order
    routeData.stops.sort((a, b) => a.order - b.order);

    const route = await Route.create(routeData);
    return route;
};

export const getRoutesForBusService = async (busId) => {
    return await Route.find({ busId }).sort({ createdAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE MANAGEMENT (vendor-only)
// ─────────────────────────────────────────────────────────────────────────────

export const createScheduleService = async (operatorId, scheduleData) => {
    const { routeId, busId, departureDate, departureTime, arrivalTime, baseFare } = scheduleData;

    // Verify bus exists and belongs to vendor
    const bus = await Bus.findById(busId);
    if (!bus) {
        throw new ApiError(404, "Bus not found.");
    }
    if (bus.operatorId.toString() !== operatorId.toString()) {
        throw new ApiError(403, "You can only create schedules for your own buses.");
    }

    // Verify route exists and belongs to this bus
    const route = await Route.findById(routeId);
    if (!route) {
        throw new ApiError(404, "Route not found.");
    }
    if (route.busId.toString() !== busId) {
        throw new ApiError(400, "This route does not belong to the specified bus.");
    }

    // Check for duplicate schedule (same bus + date + time)
    const duplicate = await Schedule.findOne({
        busId,
        departureDate: new Date(departureDate),
        departureTime,
    });
    if (duplicate) {
        throw new ApiError(409, "A schedule already exists for this bus on this date and time.");
    }

    // Copy bus.seatLayout into the schedule's seats — all set to AVAILABLE
    const seats = bus.seatLayout.map((seat) => ({
        seatNumber: seat.seatNumber,
        seatType: seat.seatType,
        deck: seat.deck,
        row: seat.row,
        column: seat.column,
        isSleeper: seat.isSleeper,
        fare: seat.fare || baseFare,
        status: "AVAILABLE",
        bookedBy: null,
        passengerName: null,
        passengerAge: null,
        passengerGender: null,
    }));

    const schedule = await Schedule.create({
        routeId,
        busId,
        operatorId,
        departureDate: new Date(departureDate),
        departureTime,
        arrivalTime,
        baseFare,
        availableSeats: seats.length,
        seats,
        boardingPoints: scheduleData.boardingPoints || [],
        droppingPoints: scheduleData.droppingPoints || [],
        cancellationPolicy: scheduleData.cancellationPolicy || [
            { hoursBeforeDeparture: 24, refundPercentage: 75 },
            { hoursBeforeDeparture: 12, refundPercentage: 50 },
            { hoursBeforeDeparture: 6, refundPercentage: 25 },
            { hoursBeforeDeparture: 0, refundPercentage: 0 },
        ],
    });

    return schedule;
};

export const getScheduleSeatsService = async (scheduleId) => {
    const schedule = await Schedule.findById(scheduleId)
        .populate({ path: "busId", select: "busName busType busNumber amenities seatLayoutType photos averageRating" })
        .populate({ path: "routeId", select: "source destination stops distanceInKm estimatedDurationInMinutes" });

    if (!schedule) {
        throw new ApiError(404, "Schedule not found.");
    }

    return {
        scheduleId: schedule._id,
        bus: schedule.busId,
        route: schedule.routeId,
        departureDate: schedule.departureDate,
        departureTime: schedule.departureTime,
        arrivalTime: schedule.arrivalTime,
        baseFare: schedule.baseFare,
        availableSeats: schedule.availableSeats,
        totalSeats: schedule.seats.length,
        seats: schedule.seats,
        boardingPoints: schedule.boardingPoints,
        droppingPoints: schedule.droppingPoints,
        cancellationPolicy: schedule.cancellationPolicy,
        status: schedule.status,
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH (public — no auth required)
// ─────────────────────────────────────────────────────────────────────────────

export const searchBusesService = async (from, to, date, filters = {}) => {
    const fromRegex = new RegExp(`^${from}$`, "i");
    const toRegex = new RegExp(`^${to}$`, "i");

    // Step 1: Find routes where BOTH "from" and "to" cities exist
    //         — either as source/destination OR inside the stops array
    const routes = await Route.find({
        status: "ACTIVE",
        $and: [
            {
                $or: [
                    { "source.city": fromRegex },
                    { "stops.city": fromRegex },
                ],
            },
            {
                $or: [
                    { "destination.city": toRegex },
                    { "stops.city": toRegex },
                ],
            },
        ],
    });

    if (routes.length === 0) {
        return [];
    }

    // Step 2: Filter routes for directional correctness
    //         "from" stop must come BEFORE "to" stop in order
    const validRoutes = [];

    for (const route of routes) {
        // Find the order of "from" city in the stops list
        const fromStop = route.stops.find((s) => fromRegex.test(s.city));
        // Find the order of "to" city in the stops list
        const toStop = route.stops.find((s) => toRegex.test(s.city));

        // Both cities must exist in stops and "from" must come before "to"
        if (fromStop && toStop && fromStop.order < toStop.order) {
            validRoutes.push({
                routeId: route._id,
                boardingStop: fromStop,
                droppingStop: toStop,
                farePerKm: route.farePerKm || 0,
                totalDistanceInKm: route.distanceInKm,
            });
        }
    }

    if (validRoutes.length === 0) {
        return [];
    }

    const routeIds = validRoutes.map((r) => r.routeId);

    // Step 3: Build the schedule query
    const searchDate = new Date(date);
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    const scheduleQuery = {
        routeId: { $in: routeIds },
        departureDate: { $gte: searchDate, $lt: nextDay },
        status: "SCHEDULED",
        availableSeats: { $gt: 0 },
    };

    // Step 4: Apply optional filters
    const busQuery = {};
    if (filters.busType) {
        busQuery.busType = filters.busType;
    }
    if (filters.isAC !== undefined) {
        busQuery.isAC = filters.isAC === "true";
    }

    // Step 5: Fetch schedules with populated bus and route info
    let query = Schedule.find(scheduleQuery)
        .populate({
            path: "busId",
            select: "busName busType busNumber amenities seatLayoutType isAC isSleeper isSeater averageRating totalRatings photos operatorName",
            match: Object.keys(busQuery).length > 0 ? busQuery : undefined,
        })
        .populate({
            path: "routeId",
            select: "source destination stops distanceInKm estimatedDurationInMinutes farePerKm",
        })
        .select("-seats") // Exclude full seat array from search results
        .sort({ departureTime: 1 });

    let schedules = await query;

    // Filter out schedules where busId is null (bus didn't match bus filters)
    schedules = schedules.filter((s) => s.busId !== null);

    // Step 6: Enrich results with boarding/dropping info and calculated fare
    const routeMap = new Map(validRoutes.map((r) => [r.routeId.toString(), r]));

    schedules = schedules.map((schedule) => {
        const scheduleObj = schedule.toObject();
        const routeInfo = routeMap.get(schedule.routeId._id.toString());

        if (routeInfo) {
            // Add the user's specific boarding and dropping stop info
            scheduleObj.boardingStop = routeInfo.boardingStop;
            scheduleObj.droppingStop = routeInfo.droppingStop;

            // Calculate fare for this specific segment if farePerKm is set
            const segmentDistance =
                routeInfo.droppingStop.distanceFromSource - routeInfo.boardingStop.distanceFromSource;

            if (routeInfo.farePerKm > 0 && segmentDistance > 0) {
                scheduleObj.calculatedFare = Math.round(routeInfo.farePerKm * segmentDistance);
            } else {
                scheduleObj.calculatedFare = scheduleObj.baseFare;
            }
        }

        return scheduleObj;
    });

    // Step 7: Apply price filter (on calculatedFare)
    if (filters.minPrice) {
        schedules = schedules.filter(
            (s) => (s.calculatedFare || s.baseFare) >= Number(filters.minPrice)
        );
    }
    if (filters.maxPrice) {
        schedules = schedules.filter(
            (s) => (s.calculatedFare || s.baseFare) <= Number(filters.maxPrice)
        );
    }

    // Step 8: Apply sort
    if (filters.sortBy === "price_low") {
        schedules.sort((a, b) => (a.calculatedFare || a.baseFare) - (b.calculatedFare || b.baseFare));
    } else if (filters.sortBy === "price_high") {
        schedules.sort((a, b) => (b.calculatedFare || b.baseFare) - (a.calculatedFare || a.baseFare));
    } else if (filters.sortBy === "rating") {
        schedules.sort((a, b) => (b.busId?.averageRating || 0) - (a.busId?.averageRating || 0));
    } else if (filters.sortBy === "departure") {
        schedules.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    }

    return schedules;
};