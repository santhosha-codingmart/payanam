import PDFDocument from "pdfkit";

const cityOf = (val) => {
  if (!val) return "N/A";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val.city) return val.city;
  return "N/A";
};

export const generateTicketPDF = (booking) =>
  new Promise((resolve, reject) => {
    try {
      const {
        bookingId = "N/A",
        passengerDetails = [],
        bookedSeats = [],
        boardingPoint = {},
        droppingPoint = {},
        totalFare = 0,
        bookingStatus = "CONFIRMED",
        bookedAt,
        paymentReference,
      } = booking;
      const user = booking.userId || {};
      const bus = booking.busId || {};
      const route = booking.routeId || {};
      const schedule = booking.scheduleId || {};
      const userName = user.name || passengerDetails[0]?.name || "N/A";
      const userEmail = user.email || "";
      const busName = bus.busName || "N/A";
      const busNumber = bus.busNumber || "N/A";
      const busType = bus.busType || "N/A";
      const source = cityOf(route.source);
      const destination = cityOf(route.destination);
      const depDate = schedule.departureDate
        ? new Date(schedule.departureDate).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          })
        : "N/A";
      const depTime = schedule.departureTime || "N/A";
      const arrTime = schedule.arrivalTime || "N/A";
      const boardingName = boardingPoint.name || "N/A";
      const boardingTime = boardingPoint.time || depTime;
      const droppingName = droppingPoint.name || "N/A";
      const droppingTime = droppingPoint.time || arrTime;
      const bookedAtStr = bookedAt
        ? new Date(bookedAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          })
        : "N/A";
      const doc = new PDFDocument({
        size: "A4",
        margins: {
          top: 40,
          bottom: 40,
          left: 50,
          right: 50,
        },
        info: {
          Title: `Payanam Ticket - ${bookingId}`,
          Author: "Payanam",
          Subject: `Bus ticket from ${source} to ${destination}`,
        },
      });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      const W = 595.28 - 100;
      const L = 50;
      const hr = (y) => {
        doc
          .moveTo(L, y)
          .lineTo(L + W, y)
          .strokeColor("#000000")
          .lineWidth(0.5)
          .stroke();
      };
      const field = (label, value, x, y, maxW) => {
        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#000000")
          .text(label.toUpperCase(), x, y);
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#000000")
          .text(value, x, y + 11, {
            width: maxW,
            lineBreak: false,
          });
      };
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#000000")
        .text("PAYANAM", L, 40, {
          align: "center",
          width: W,
        });
      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#000000")
        .text("Bus Ticket / Boarding Pass", L, 66, {
          align: "center",
          width: W,
        });
      let y = 86;
      hr(y);
      y += 10;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`Status: ${bookingStatus}`, L, y);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`Booking Ref: ${bookingId}`, L, y, {
          align: "right",
          width: W,
        });
      y += 24;
      hr(y);
      y += 12;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#000000")
        .text("JOURNEY DETAILS", L, y);
      y += 14;
      const col = W / 5;
      field("From", source, L, y, col - 4);
      field("Date", depDate, L + col, y, col - 4);
      field("Departure", depTime, L + col * 2, y, col - 4);
      field("Arrival", arrTime, L + col * 3, y, col - 4);
      field("To", destination, L + col * 4, y, col - 4);
      y += 38;
      hr(y);
      y += 12;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("BOARDING & DROPPING POINTS", L, y);
      y += 14;
      const halfW = W / 2 - 8;
      field("Boarding Point", boardingName, L, y, halfW);
      field("Boarding Time", boardingTime, L + halfW / 2, y, halfW / 2);
      field("Dropping Point", droppingName, L + W / 2, y, halfW);
      field("Dropping Time", droppingTime, L + W / 2 + halfW / 2, y, halfW / 2);
      y += 38;
      hr(y);
      y += 12;
      doc.font("Helvetica-Bold").fontSize(9).text("BUS DETAILS", L, y);
      y += 14;
      field("Bus Name", busName, L, y, W / 3 - 4);
      field("Bus No.", busNumber, L + W / 3, y, W / 3 - 4);
      field("Bus Type", busType, L + (W * 2) / 3, y, W / 3 - 4);
      y += 38;
      hr(y);
      y += 12;
      doc.font("Helvetica-Bold").fontSize(9).text("PASSENGERS", L, y);
      y += 14;
      const th = {
        name: L,
        seat: L + 200,
        age: L + 280,
        gender: L + 340,
      };
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#000000")
        .text("NAME", th.name, y)
        .text("SEAT", th.seat, y)
        .text("AGE", th.age, y)
        .text("GENDER", th.gender, y);
      y += 4;
      hr(y + 10);
      y += 14;
      doc.font("Helvetica").fontSize(10);
      passengerDetails.forEach((p, i) => {
        const seat = p.seatNumber || bookedSeats[i] || "N/A";
        doc
          .fillColor("#000000")
          .text(p.name || "N/A", th.name, y, {
            width: 185,
            lineBreak: false,
          })
          .text(seat, th.seat, y)
          .text(String(p.age), th.age, y)
          .text(p.gender || "N/A", th.gender, y);
        y += 20;
      });
      hr(y);
      y += 12;
      doc.font("Helvetica-Bold").fontSize(9).text("FARE & PAYMENT", L, y);
      y += 14;
      field("Total Fare (INR)", `Rs. ${totalFare}`, L, y, W / 2 - 4);
      field("Booked At", bookedAtStr, L + W / 2, y, W / 2 - 4);
      if (paymentReference) {
        y += 36;
        field("Payment Reference", paymentReference, L, y, W);
        y += 22;
      } else {
        y += 36;
      }
      hr(y);
      y += 12;
      field("Passenger Name", userName, L, y, W / 2 - 4);
      field("Email", userEmail, L + W / 2, y, W / 2 - 4);
      y += 40;
      hr(y);
      y += 12;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#000000")
        .text(
          "Please carry a valid government-issued photo ID. This ticket is non-transferable. " +
            "For support contact: payanamapplication@gmail.com",
          L,
          y,
          {
            width: W,
            align: "center",
          },
        );
      y += 20;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#000000")
        .text("Safe Travels with Payanam!", L, y, {
          width: W,
          align: "center",
        });
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
