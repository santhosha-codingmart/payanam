import * as priceLockService from "../services/priceLock.service.js";

export const createPriceLock = async (req, res, next) => {
  try {
    const { scheduleId, lockDurationId } = req.body;
    const userId = req.user._id;
    const priceLock = await priceLockService.createPriceLockService(
      userId,
      scheduleId,
      lockDurationId,
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

export const getUserPriceLocks = async (req, res, next) => {
  try {
    const locks = await priceLockService.getUserPriceLocksService(req.user._id);
    return res.status(200).json({
      success: true,
      message:
        locks.length > 0
          ? `Found ${locks.length} price lock(s).`
          : "No price locks found.",
      count: locks.length,
      data: locks,
    });
  } catch (error) {
    next(error);
  }
};

export const getPriceLockById = async (req, res, next) => {
  try {
    const lock = await priceLockService.getPriceLockByIdService(
      req.params.priceLockId,
      req.user._id,
    );
    return res.status(200).json({
      success: true,
      data: lock,
    });
  } catch (error) {
    next(error);
  }
};

export const usePriceLock = async (req, res, next) => {
  try {
    const result = await priceLockService.usePriceLockService(
      req.params.priceLockId,
      req.user._id,
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
