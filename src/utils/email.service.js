import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { ApiError } from "./ApiError.js";

dotenv.config();
const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

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
                        <h2 style="color: #1a1a2e; margin: 0; font-size: 24px;">Payanam</h2>
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
                        This code expires in <strong>5 minutes</strong>.
                    </p>

                    <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;" />

                    <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
                        If you did not request this, you can safely ignore this email.<br/>
                        Do not share this OTP with anyone — Payanam will never ask for it.
                    </p>
                </div>
            `,
    };
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${toEmail}`);
  } catch (error) {
    console.error("Nodemailer Gmail Error:", error);
    throw new ApiError(500, "Failed to send OTP email. Please try again.");
  }
};

export const sendBookingConfirmationEmail = async (toEmail, details) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: `"Payanam Tickets" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `Booking Confirmed - ${details.bookingId} | Payanam`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">

  <!-- Header -->
  <div style="background:#1a1a4e;padding:28px 32px;text-align:center;">
    <h1 style="margin:0;font-size:22px;color:#f5c518;letter-spacing:2px;">Payanam</h1>
    <p style="margin:10px 0 0;color:#50c878;font-size:14px;font-weight:600;">Booking Confirmed</p>
  </div>

  <!-- Greeting -->
  <div style="padding:28px 32px 0;">
    <p style="margin:0;color:#333;font-size:16px;">Hi <strong>${details.userName}</strong>,</p>
    <p style="margin:10px 0 0;color:#555;font-size:14px;line-height:1.7;">
      Your bus ticket has been confirmed. Please find your boarding pass PDF attached to this email.
      You can also download it anytime from <strong>My Bookings</strong> in the Payanam app.
    </p>
  </div>

  <!-- Summary card -->
  <div style="margin:24px 32px 0;background:#f8f8f8;border-radius:8px;padding:20px;border:1px solid #e0e0e0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Booking Ref</td>
        <td style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;text-align:right;">Route</td>
      </tr>
      <tr>
        <td style="color:#f5c518;font-size:20px;font-weight:800;letter-spacing:2px;background:#1a1a4e;padding:8px 12px;border-radius:4px;">${details.bookingId}</td>
        <td style="color:#333;font-size:15px;font-weight:700;text-align:right;">${details.source} &rarr; ${details.destination}</td>
      </tr>
      <tr><td colspan="2" style="padding:12px 0 0;"><hr style="border:none;border-top:1px solid #e0e0e0;margin:0;"/></td></tr>
      <tr style="vertical-align:top;">
        <td style="padding-top:12px;">
          <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Departure</p>
          <p style="margin:4px 0 0;color:#333;font-size:14px;font-weight:600;">${details.departureDate}</p>
          <p style="margin:2px 0 0;color:#1a1a4e;font-size:13px;">${details.departureTime} &rarr; ${details.arrivalTime}</p>
        </td>
        <td style="padding-top:12px;text-align:right;">
          <p style="margin:0;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Total Fare</p>
          <p style="margin:4px 0 0;color:#27ae60;font-size:20px;font-weight:800;">&#8377;${details.totalFare}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- PDF callout -->
  <div style="margin:20px 32px 0;background:#fffbea;border:1px solid #f5c518;border-radius:8px;padding:16px 18px;">
    <p style="margin:0;color:#333;font-size:13px;font-weight:700;">Your ticket PDF is attached to this email.</p>
    <p style="margin:6px 0 0;color:#555;font-size:12px;">Open or print the attachment to use as your boarding pass at the bus stand. Carry a valid government-issued photo ID.</p>
  </div>

  <!-- Footer -->
  <div style="padding:24px 32px;text-align:center;border-top:1px solid #e0e0e0;margin-top:24px;">
    <p style="margin:0 0 6px;color:#333;font-size:13px;font-weight:600;">Have a safe journey!</p>
    <p style="margin:0;color:#888;font-size:11px;">For support: ${process.env.GMAIL_USER}</p>
  </div>
</div>
</body></html>`,
      attachments: details.pdfBuffer
        ? [
            {
              filename: `Payanam-Ticket-${details.bookingId}.pdf`,
              content: details.pdfBuffer,
              contentType: "application/pdf",
            },
          ]
        : [],
    };
    await transporter.sendMail(mailOptions);
    console.log(
      `Confirmation email + PDF sent to ${toEmail} for ${details.bookingId}`,
    );
  } catch (error) {
    console.error("[Email] Booking confirmation email failed:", error.message);
  }
};

export const sendBookingCancellationEmail = async (toEmail, details) => {
  try {
    const transporter = createTransporter();
    const hasRefund = details.refundAmount > 0;
    const cancelDate = new Date(details.cancelledAt).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
    const mailOptions = {
      from: `"Payanam Tickets" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: `Booking Cancelled - ${details.bookingId} | Payanam`,
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Segoe UI', Arial, sans-serif;">
  <div style="max-width:600px; margin:32px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e0e0e0;">

    <!-- Header -->
    <div style="background:#1a1a4e; padding:28px 32px; text-align:center;">
      <h1 style="margin:0; font-size:22px; color:#f5c518; letter-spacing:2px;">Payanam</h1>
      <p style="margin:10px 0 0; color:#e74c3c; font-size:14px; font-weight:600;">Booking Cancelled</p>
    </div>

    <!-- Booking ID Banner -->
    <div style="background:#f8f8f8; padding:20px 32px; border-bottom:1px solid #e0e0e0;">
      <p style="margin:0 0 4px; color:#888; font-size:11px; letter-spacing:1.5px; text-transform:uppercase;">Cancelled Booking</p>
      <h2 style="margin:0; color:#333; font-size:22px; letter-spacing:2px; font-weight:800;">${details.bookingId}</h2>
      <p style="margin:6px 0 0; color:#888; font-size:12px;">Cancelled on ${cancelDate}</p>
    </div>

    <!-- Journey Summary -->
    <div style="padding:24px 32px;">
      <div style="background:#f8f8f8; border-radius:8px; padding:20px 24px; margin-bottom:20px; border:1px solid #e0e0e0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding-bottom:8px;">
              <p style="margin:0 0 2px; color:#888; font-size:11px;">FROM</p>
              <p style="margin:0; color:#333; font-size:18px; font-weight:700;">${details.source}</p>
            </td>
            <td style="text-align:center;color:#888;font-size:20px;">&rarr;</td>
            <td style="padding-bottom:8px;text-align:right;">
              <p style="margin:0 0 2px; color:#888; font-size:11px;">TO</p>
              <p style="margin:0; color:#333; font-size:18px; font-weight:700;">${details.destination}</p>
            </td>
          </tr>
        </table>
        <div style="margin-top:14px; padding-top:14px; border-top:1px solid #e0e0e0;">
          <p style="margin:0; color:#555; font-size:13px;">${details.departureDate} &nbsp;&bull;&nbsp; ${details.departureTime}</p>
        </div>
      </div>

      <!-- Refund Box -->
      <div style="background:${hasRefund ? "#f0fef4" : "#fef2f2"}; border:1px solid ${hasRefund ? "#50c878" : "#e74c3c"}; border-radius:8px; padding:20px 24px;">
        <p style="margin:0 0 12px; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:1.5px;">Refund Summary</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="color:#555; font-size:14px; padding-bottom:8px;">Fare Paid</td>
            <td style="color:#333; font-size:14px; font-weight:600; text-align:right; padding-bottom:8px;">&#8377;${details.totalFare}</td>
          </tr>
          <tr style="border-top:1px solid #e0e0e0;">
            <td style="color:#555; font-size:15px; font-weight:600; padding-top:10px;">Refund Amount</td>
            <td style="color:${hasRefund ? "#27ae60" : "#e74c3c"}; font-size:18px; font-weight:800; text-align:right; padding-top:10px;">&#8377;${details.refundAmount}</td>
          </tr>
        </table>
        <p style="margin:12px 0 0; color:#555; font-size:12px;">
          ${hasRefund ? "Your refund will be credited to your original payment method within <strong>5-7 business days</strong>." : "No refund applicable as per the cancellation policy agreed at the time of booking."}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8f8f8; padding:24px 32px; text-align:center; border-top:1px solid #e0e0e0;">
      <p style="margin:0 0 8px; color:#333; font-size:13px;">Sorry to see you go, ${details.userName}!</p>
      <p style="margin:0; color:#888; font-size:12px;">Need help? Reach us at ${process.env.GMAIL_USER}<br/>We hope to see you on board again soon.</p>
    </div>
  </div>
</body>
</html>`,
    };
    await transporter.sendMail(mailOptions);
    console.log(
      `Booking cancellation email sent to ${toEmail} for ${details.bookingId}`,
    );
  } catch (error) {
    console.error("[Email] Booking cancellation email failed:", error.message);
  }
};
