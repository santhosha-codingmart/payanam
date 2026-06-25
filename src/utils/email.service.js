import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { ApiError } from "./ApiError.js";

dotenv.config();

// Best Practice: Build a fresh transporter for every send call.
// Reusing a module-level transporter causes ECONNECTION errors because
// Mailtrap (and most SMTP servers) close idle TCP connections silently.
// Creating a new transporter per call is cheap and avoids stale-socket issues.
const createTransporter = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST || "sandbox.smtp.mailtrap.io",
        port: parseInt(process.env.SMTP_PORT, 10) || 2525,
        auth: {
            user: process.env.SMTP_USER || "df5f3e7a4a64ef",
            pass: process.env.SMTP_PASS || "b5c9e77f10f5c0"
        },
        // Disable connection pooling – always open a fresh connection
        pool: false,
        // Fail fast so the user gets a quick error instead of hanging
        connectionTimeout: 10_000, // 10 seconds to establish TCP connection
        greetingTimeout: 10_000,   // 10 seconds to receive SMTP greeting
        socketTimeout: 15_000,     // 15 seconds of socket inactivity allowed
    });

// A highly reusable function to send an OTP
export const sendOTPEmail = async (toEmail, otpCode) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: '"Payanam Support" <no-reply@payanam.com>', // Who the email is from
            to: toEmail,                                       // The user's email address
            subject: "Your Password Reset Code",               // Subject line
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                    <h2>Password Reset Request</h2>
                    <p>You recently requested to reset your password. Use the code below to proceed.</p>
                    <h1 style="color: #4CAF50; letter-spacing: 5px; font-size: 40px;">${otpCode}</h1>
                    <p><strong>This code will expire in exactly 5 minutes.</strong></p>
                    <p style="color: gray; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
                </div>
            `
        };

        // Await the transporter to actually fire the email across the internet
        await transporter.sendMail(mailOptions);
        console.log(`🎟️ OTP Email successfully sent to ${toEmail}`);

    } catch (error) {
        console.error("Nodemailer Error:", error);
        throw new ApiError(500, "Failed to send OTP email to user.");
    }
};
