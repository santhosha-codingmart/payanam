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

    if (await User.findOne({ email: email })) {
        throw new ApiError(409, "Email is already Registered");
    }

    let BPass = await bCyrpt.hash(password, 10);
    const createdUser = await User.create({
        email,
        password: BPass,
        authProvider: "local"
    });

    return createdUser;
}

export const loginByEmail = async (userData) => {
    const { email, password } = userData;
    if (!email) {
        throw new ApiError(400, "Email is required");
    }
    if (!password) {
        throw new ApiError(400, "Password is required");
    }

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
        throw new ApiError(401, "Invalid credentials");
    }

    else {
        const success = await bCyrpt.compare(password, existingUser.password);
        if (success) {

            return existingUser;
        }

        else {
            throw new ApiError(401, "Wrong Password");
        }
    }
}

export const requestPasswordReset = async (email) => {
    // 1. Verify user exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
        throw new ApiError(404, "User with this email does not exist");
    }

    // 2. Generate a highly secure random 6-digit number
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // 3. Save to Redis with a 300 second (5 min) Time To Live barrier
    await redis.set(`otp:${email}`, otpCode, "EX", 300);

    // 4. Send the email
    await sendOTPEmail(email, otpCode);

    return true;
};

export const verifyAndResetPassword = async (email, otpCode, newPassword) => {
    // 1. Fetch the code from Redis using the email as the key
    const storedOtp = await redis.get(`otp:${email}`);

    // Redis returns null if the 5 minutes are up (TTL expired)
    if (!storedOtp) {
        throw new ApiError(400, "OTP is invalid or has expired");
    }

    if (storedOtp !== otpCode) {
        throw new ApiError(401, "Incorrect OTP code");
    }

    // 2. Hash the new password securely
    const hashedPassword = await bCyrpt.hash(newPassword, 10);

    // 3. Update the user document in MongoDB
    await User.updateOne({ email }, { password: hashedPassword });

    // 4. Forcefully delete the token from Redis so hackers can't reuse it!
    await redis.del(`otp:${email}`);

    return true;
};

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE OTP AUTH  (register + login share the same 2 endpoints)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1 — Send an OTP to the given mobile number.
 * Works for BOTH new and existing users.
 * The OTP is stored in Redis under key  mobile-otp:{mobile}  for 5 minutes.
 *
 * @param {string} mobile  - E.164 format e.g. "+919876543210"
 */
export const sendMobileOTP = async (mobile) => {
    // 1. Generate a cryptographically secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // 2. Store in Redis — prefixed with "mobile-otp:" to avoid collision
    //    with email-based "otp:" keys used in forgot-password
    await redis.set(`mobile-otp:${mobile}`, otpCode, "EX", 300); // 5 min TTL

    // 3. Fire the SMS
    await sendOTPSms(mobile, otpCode);

    return true;
};

/**
 * Step 2 — Verify OTP and either LOGIN or REGISTER the user automatically.
 *
 * - If a user with this mobile already exists  → LOGIN  (return user doc)
 * - If no user with this mobile exists         → CREATE account, then LOGIN
 *
 * This "seamless" pattern (used by Swiggy, Uber, etc.) means the frontend
 * never needs separate register/login pages for mobile auth.
 *
 * @param {string} mobile   - E.164 format e.g. "+919876543210"
 * @param {string} otpCode  - The 6-digit OTP the user typed
 * @returns {object}  The user document (new or existing)
 */
export const verifyMobileOTP = async (mobile, otpCode) => {
    // 1. Fetch OTP from Redis
    const storedOtp = await redis.get(`mobile-otp:${mobile}`);

    // Redis returns null when the TTL has expired
    if (!storedOtp) {
        throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (storedOtp !== otpCode) {
        throw new ApiError(401, "Incorrect OTP. Please check and try again.");
    }

    // 2. OTP correct — delete immediately so it cannot be reused
    await redis.del(`mobile-otp:${mobile}`);

    // 3. Check if user exists
    let user = await User.findOne({ phoneNo: mobile });

    if (user) {
        // ── EXISTING USER → Login path ────────────────────────────────────
        if (!user.isPhoneVerified) {
            user.isPhoneVerified = true;
            await user.save();
        }
        return user;

    } else {
        // ── NEW USER → Register path ──────────────────────────────────────
        // Minimal account created; profile can be completed later
        user = await User.create({
            phoneNo: mobile,
            isPhoneVerified: true,
        });
        return user;
    }
};