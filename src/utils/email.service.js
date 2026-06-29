import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { ApiError } from "./ApiError.js";

dotenv.config();

// ─── Gmail SMTP Transporter ──────────────────────────────────────────────────
// Uses Gmail's real SMTP with an App Password (NOT your Gmail login password).
// App Passwords are 16-character codes generated at:
//   https://myaccount.google.com/apppasswords
//
// Required .env variables:
//   GMAIL_USER  → your Gmail address  (e.g. yourname@gmail.com)
//   GMAIL_PASS  → 16-char App Password (e.g. abcd efgh ijkl mnop)
// ─────────────────────────────────────────────────────────────────────────────
const createTransporter = () =>
    nodemailer.createTransport({
        service: "gmail",      // Nodemailer knows Gmail's host/port automatically
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS, // App Password — NOT your Gmail password
        },
        // Fail fast so users get a quick error instead of hanging
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
    });

// ─── Send OTP Email ───────────────────────────────────────────────────────────
export const sendOTPEmail = async (toEmail, otpCode) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: `"Payanam Support" <${process.env.GMAIL_USER}>`,
            to: toEmail,
            subject: "Your Payanam OTP Code",
            html: `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9f9f9; border-radius: 12px; border: 1px solid #e0e0e0;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h2 style="color: #1a1a2e; margin: 0; font-size: 24px;">🎟️ Payanam</h2>
                        <p style="color: #555; margin: 8px 0 0;">Password Reset Request</p>
                    </div>

                    <p style="color: #333; font-size: 15px; line-height: 1.6;">
                        You requested to reset your password. Use the OTP below to proceed.
                    </p>

                    <div style="background: #1a1a2e; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                        <p style="color: #aaa; font-size: 13px; margin: 0 0 8px; letter-spacing: 1px; text-transform: uppercase;">Your One-Time Password</p>
                        <h1 style="color: #f5c518; letter-spacing: 12px; font-size: 42px; margin: 0; font-weight: 800;">${otpCode}</h1>
                    </div>

                    <p style="color: #e74c3c; font-size: 13px; text-align: center; font-weight: 600; margin: 0;">
                        ⏱️ This code expires in <strong>5 minutes</strong>.
                    </p>

                    <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />

                    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                        If you did not request this, you can safely ignore this email.<br/>
                        Do not share this OTP with anyone — Payanam will never ask for it.
                    </p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`🎟️ OTP Email successfully sent to ${toEmail}`);

    } catch (error) {
        console.error("Nodemailer Gmail Error:", error);
        throw new ApiError(500, "Failed to send OTP email. Please try again.");
    }
};
