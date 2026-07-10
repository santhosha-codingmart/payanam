import twilio from "twilio";
import { ApiError } from "./ApiError.js";

const createClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new ApiError(
      500,
      "SMS service is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env",
    );
  }
  return twilio(accountSid, authToken);
};

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
