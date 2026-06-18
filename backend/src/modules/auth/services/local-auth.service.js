import crypto from "crypto";
import bCyrpt from "bcrypt";
import User from "../../users/models/user.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import redis from "../../../config/redis.js";
import { sendOTPEmail } from "../../../utils/email.service.js";

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