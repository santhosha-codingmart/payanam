// ─────────────────────────────────────────────────────────────────────────────
// PriceLock Controller — The HTTP Bridge for Price Locking
//
// Controllers are thin. Their ONLY job is:
//   1. Extract data from the HTTP Request
//   2. Call the appropriate Service function
//   3. Format the result into an HTTP Response
//   4. Catch errors and forward them to the global error handler
// ─────────────────────────────────────────────────────────────────────────────

import * as priceLockService from "../services/priceLock.service.js";

// POST /api/v1/flights/price-locks — Create a new price lock
export const createPriceLock = async (req, res, next) => {
    try {
        const { scheduleId, lockDurationId } = req.body;
        const userId = req.user._id;

        const priceLock = await priceLockService.createPriceLockService(
            userId,
            scheduleId,
            lockDurationId
        );

        return res.status(201).json({
            success: true,
            message: `Price locked successfully for ${priceLock.lockDurationId}. Fee: ₹${priceLock.lockFee}.`,
            data: priceLock,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/flights/price-locks/my-locks — Get all price locks for the user
export const getUserPriceLocks = async (req, res, next) => {
    try {
        const locks = await priceLockService.getUserPriceLocksService(req.user._id);

        return res.status(200).json({
            success: true,
            message: locks.length > 0
                ? `Found ${locks.length} price lock(s).`
                : "No price locks found.",
            count: locks.length,
            data: locks,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/flights/price-locks/:priceLockId — Get a specific price lock
export const getPriceLockById = async (req, res, next) => {
    try {
        const lock = await priceLockService.getPriceLockByIdService(
            req.params.priceLockId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            data: lock,
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/flights/price-locks/:priceLockId/book — Use a price lock to book
export const usePriceLock = async (req, res, next) => {
    try {
        const result = await priceLockService.usePriceLockService(
            req.params.priceLockId,
            req.user._id
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};
