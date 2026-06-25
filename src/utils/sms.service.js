import twilio from "twilio";
import { ApiError } from "./ApiError.js";

// ─── Twilio credentials come from .env ──────────────────────────────────────
// TWILIO_ACCOUNT_SID  → Your Account SID  (starts with "AC...")
// TWILIO_AUTH_TOKEN   → Your Auth Token
// TWILIO_PHONE_NUMBER → Your Twilio phone number (e.g. "+12345678901")
//
// Get these from: https://console.twilio.com
// Free trial gives you $15 credit which is enough for testing.

const createClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        throw new ApiError(500, "SMS service is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env");
    }

    return twilio(accountSid, authToken);
};

/**
 * Send a one-time password via SMS to the given mobile number.
 * @param {string} toMobile  - E.164 format e.g. "+919876543210"
 * @param {string} otpCode   - The 6-digit OTP string
 */
export const sendOTPSms = async (toMobile, otpCode) => {
    try {
        const client = createClient();

        await client.messages.create({
            body: `Your Payanam OTP is: ${otpCode}. Valid for 5 minutes. Do not share this with anyone.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: toMobile,
        });

        console.log(`📱 OTP SMS successfully sent to ${toMobile}`);

    } catch (error) {
        console.error("Twilio SMS Error:", error);
        throw new ApiError(500, "Failed to send OTP SMS. Please try again.");
    }
};
