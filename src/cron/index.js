import cron from "node-cron";
import mongoose from "mongoose";
import Booking from "../modules/bookings/models/booking.model.js";
import { Schedule } from "../modules/bus/models/schedule.model.js";
import logger from "../config/logger.js";

export const startCronJobs = () => {
  cron.schedule("*/15 * * * *", async () => {
    logger.info("[Cron] Starting abandoned bookings cleanup...");
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const abandonedBookings = await Booking.find({
        bookingStatus: "PENDING",
        createdAt: {
          $lt: thirtyMinutesAgo,
        },
      });
      if (abandonedBookings.length === 0) {
        logger.info("[Cron] No abandoned bookings found.");
        return;
      }
      let cleanupCount = 0;
      for (const booking of abandonedBookings) {
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const schedule = await Schedule.findById(
              booking.scheduleId,
            ).session(session);
            if (schedule) {
              for (const seatNumber of booking.bookedSeats) {
                const seatIndex = schedule.seats.findIndex(
                  (s) => s.seatNumber === seatNumber,
                );
                if (
                  seatIndex !== -1 &&
                  schedule.seats[seatIndex].status === "BOOKED"
                ) {
                  schedule.seats[seatIndex].status = "AVAILABLE";
                  schedule.seats[seatIndex].passengerName = null;
                  schedule.seats[seatIndex].passengerGender = null;
                  schedule.seats[seatIndex].passengerAge = null;
                  schedule.seats[seatIndex].bookedBy = null;
                }
              }
              schedule.availableSeats += booking.bookedSeats.length;
              await schedule.save({
                session,
              });
            }
            booking.bookingStatus = "CANCELLED";
            booking.paymentStatus = "FAILED";
            booking.cancelledAt = new Date();
            await booking.save({
              session,
            });
          });
          cleanupCount++;
        } catch (err) {
          logger.error(
            `[Cron] Failed to cleanup abandoned booking ${booking.bookingId}`,
            {
              error: err.message,
            },
          );
        } finally {
          session.endSession();
        }
      }
      logger.info(
        `[Cron] Abandoned bookings cleanup completed. Cleaned up ${cleanupCount} bookings.`,
      );
    } catch (error) {
      logger.error("[Cron] Abandoned bookings job failed", {
        error: error.message,
      });
    }
  });
  logger.info("[Cron] Background jobs initialized successfully.");
};
