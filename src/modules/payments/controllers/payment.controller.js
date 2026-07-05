// =============================================================================
// Payment Controller — Handles HTTP layer for payment operations
//
// Responsibilities:
//   - Extract data from req (body, params, user)
//   - Call the appropriate service function
//   - Send a consistent JSON response
//   - All actual logic lives in payment.service.js
// =============================================================================

import {
    createRazorpayOrder,
    verifyAndConfirmPayment,
    handlePaymentFailure,
    getPaymentStatus,
} from "../services/payment.service.js";

// =============================================================================
// POST /api/v1/payments/create-order
// =============================================================================
// Creates a Razorpay order and returns the orderId + amount so the frontend
// can open the Razorpay checkout modal.
// =============================================================================
export const createOrder = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { bookingMongoId } = req.body;

        const orderDetails = await createRazorpayOrder(userId, bookingMongoId);

        res.status(201).json({
            success: true,
            message: "Razorpay order created successfully.",
            data: orderDetails,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// POST /api/v1/payments/verify
// =============================================================================
// Verifies the Razorpay signature after the user completes payment.
// On success, confirms the booking and marks seats as booked.
// =============================================================================
export const verifyPayment = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            bookingMongoId,
        } = req.body;

        const result = await verifyAndConfirmPayment(userId, {
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            bookingMongoId,
        });

        res.status(200).json({
            success: true,
            message: "Payment verified successfully. Booking confirmed!",
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// POST /api/v1/payments/failure
// =============================================================================
// Logs a payment failure. Called by the frontend when Razorpay checkout fails.
// The booking remains PENDING so the user can retry.
// =============================================================================
export const paymentFailure = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { razorpayOrderId, errorCode, errorDescription, bookingMongoId } = req.body;

        const result = await handlePaymentFailure(userId, {
            razorpayOrderId,
            errorCode,
            errorDescription,
            bookingMongoId,
        });

        res.status(200).json({
            success: true,
            message: result.message,
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

// =============================================================================
// GET /api/v1/payments/status/:bookingMongoId
// =============================================================================
// Returns the payment status for a given booking.
// Used by the frontend to poll for confirmation after checkout completes.
// =============================================================================
export const getStatus = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const { bookingMongoId } = req.params;

        const status = await getPaymentStatus(userId, bookingMongoId);

        res.status(200).json({
            success: true,
            data: status,
        });
    } catch (error) {
        next(error);
    }
};
