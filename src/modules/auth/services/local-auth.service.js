import crypto from "crypto";
import bCyrpt from "bcrypt";
import User from "../../users/models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import { sendOTPEmail } from "../../../utils/email.service.js";
import { sendOTPSms } from "../../../utils/sms.service.js";

export const registerByEmail = async (userData) => {
  const { email, password } = userData;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }
  if (
    await User.findOne({
      email: email,
    })
  ) {
    throw new ApiError(409, "Email is already Registered");
  }
  let BPass = await bCyrpt.hash(password, 10);
  const createdUser = await User.create({
    email,
    password: BPass,
    authProvider: "local",
  });
  return createdUser;
};

export const registerAdminByEmail = async (userData) => {
  const { name, email, password, adminSecretKey } = userData;
  if (!adminSecretKey || adminSecretKey !== process.env.ADMIN_SECRET_KEY) {
    throw new ApiError(403, "Invalid admin secret key. Registration denied.");
  }
  if (
    await User.findOne({
      email,
    })
  ) {
    throw new ApiError(409, "This email is already registered.");
  }
  const hashedPassword = await bCyrpt.hash(password, 10);
  const admin = await User.create({
    name,
    email,
    password: hashedPassword,
    role: "admin",
    authProvider: "local",
  });
  return admin;
};

export const registerVendorByEmail = async (userData) => {
  const { name, email, password, phoneNo, companyName, gstNumber } = userData;
  if (
    await User.findOne({
      email,
    })
  ) {
    throw new ApiError(409, "This email is already registered.");
  }
  if (
    phoneNo &&
    (await User.findOne({
      phoneNo,
    }))
  ) {
    throw new ApiError(409, "This phone number is already registered.");
  }
  const hashedPassword = await bCyrpt.hash(password, 10);
  const vendor = await User.create({
    name,
    email,
    password: hashedPassword,
    phoneNo: phoneNo || undefined,
    companyName: companyName,
    gstNumber: gstNumber || undefined,
    role: "vendor",
    authProvider: "local",
  });
  return vendor;
};

export const loginByEmail = async (userData) => {
  const { email, password } = userData;
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }
  const existingUser = await User.findOne({
    email,
  });
  if (!existingUser) {
    throw new ApiError(401, "Invalid credentials");
  } else {
    const success = await bCyrpt.compare(password, existingUser.password);
    if (success) {
      return existingUser;
    } else {
      throw new ApiError(401, "Wrong Password");
    }
  }
};

export const requestPasswordReset = async (email) => {
  const existingUser = await User.findOne({
    email,
  });
  if (!existingUser) {
    throw new ApiError(404, "User with this email does not exist");
  }
  const otpCode = crypto.randomInt(100000, 999999).toString();
  setTimeout(() => {
    redis.set(`otp:${email}`, otpCode, "EX", 300).catch((err) => {
      console.error("Redis error saving OTP:", err);
    });
    sendOTPEmail(email, otpCode).catch((err) => {
      console.error("Failed to send OTP email in background:", err);
    });
  }, 0);
  return true;
};

export const verifyAndResetPassword = async (email, otpCode, newPassword) => {
  const storedOtp = await redis.get(`otp:${email}`);
  if (!storedOtp) {
    throw new ApiError(400, "OTP is invalid or has expired");
  }
  if (storedOtp !== otpCode) {
    throw new ApiError(401, "Incorrect OTP code");
  }
  const hashedPassword = await bCyrpt.hash(newPassword, 10);
  await User.updateOne(
    {
      email,
    },
    {
      password: hashedPassword,
    },
  );
  await redis.del(`otp:${email}`);
  return true;
};

export const sendMobileOTP = async (mobile) => {
  const otpCode = crypto.randomInt(100000, 999999).toString();
  setTimeout(() => {
    redis.set(`mobile-otp:${mobile}`, otpCode, "EX", 300).catch((err) => {
      console.error("Redis error saving mobile OTP:", err);
    });
    sendOTPSms(mobile, otpCode).catch((err) => {
      console.error("Failed to send OTP SMS in background:", err);
    });
  }, 0);
  return true;
};

export const verifyMobileOTP = async (mobile, otpCode) => {
  const storedOtp = await redis.get(`mobile-otp:${mobile}`);
  if (!storedOtp) {
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }
  if (storedOtp !== otpCode) {
    throw new ApiError(401, "Incorrect OTP. Please check and try again.");
  }
  await redis.del(`mobile-otp:${mobile}`);
  let user = await User.findOne({
    phoneNo: mobile,
  });
  if (user) {
    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }
    return user;
  } else {
    user = await User.create({
      phoneNo: mobile,
      isPhoneVerified: true,
    });
    return user;
  }
};
