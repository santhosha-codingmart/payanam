import {
  createRazorpayOrder,
  verifyAndConfirmPayment,
  handlePaymentFailure,
  getPaymentStatus,
} from "../services/payment.service.js";

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

export const paymentFailure = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { razorpayOrderId, errorCode, errorDescription, bookingMongoId } =
      req.body;
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
