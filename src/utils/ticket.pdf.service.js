// =============================================================================
// Ticket PDF Generator — produces a branded PDF ticket using PDFKit
//
// WHY PDFKIT:
//   - Pure Node.js, no browser / headless Chrome dependency
//   - Stream-based → we can collect output into a Buffer in memory and
//     pass it directly to Nodemailer as an attachment without touching disk
//
// RETURNS:  Promise<Buffer>  — raw PDF bytes ready for:
//   • Nodemailer attachment  (content: buffer, contentType: 'application/pdf')
//   • Express download       (res.end(buffer) + Content-Disposition header)
// =============================================================================

import PDFDocument from "pdfkit";

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    navy:     "#1a1a4e",
    darkBg:   "#13132a",
    cardBg:   "#1e1e3a",
    border:   "#2a2a4a",
    gold:     "#f5c518",
    green:    "#50c878",
    muted:    "#7a82a8",
    text:     "#e0e0ff",
    subtext:  "#a0a8d0",
    white:    "#ffffff",
    red:      "#e74c3c",
};

// Helper: draw a filled rounded rectangle
const roundedRect = (doc, x, y, w, h, r, fillColor) => {
    doc
        .roundedRect(x, y, w, h, r)
        .fill(fillColor);
};

// Helper: right-aligned text
const textRight = (doc, text, x, y, w, opts = {}) => {
    doc.text(text, x, y, { width: w, align: "right", ...opts });
};

/**
 * generateTicketPDF
 *
 * @param {object} booking   Mongoose booking document (populated)
 * @param {object} opts      Optional overrides
 * @returns {Promise<Buffer>}
 */
export const generateTicketPDF = (booking, opts = {}) =>
    new Promise((resolve, reject) => {
        try {
            // ── Destructure booking fields ────────────────────────────────────
            const {
                bookingId,
                passengerDetails = [],
                bookedSeats      = [],
                boardingPoint    = {},
                droppingPoint    = {},
                totalFare        = 0,
                bookingStatus    = "CONFIRMED",
                bookedAt,
                paymentReference,
            } = booking;

            // Populated sub-documents (may be plain objects or Mongoose docs)
            const user     = booking.userId     || {};
            const bus      = booking.busId      || {};
            const route    = booking.routeId    || {};
            const schedule = booking.scheduleId || {};

            const userName    = user.name       || "Passenger";
            const userEmail   = user.email      || "";
            const busName     = bus.busName     || "—";
            const busNumber   = bus.busNumber   || "—";
            const busType     = bus.busType     || "—";
            const source      = route.source    || "—";
            const destination = route.destination || "—";

            const depDate = schedule.departureDate
                ? new Date(schedule.departureDate).toLocaleDateString("en-IN", {
                      day: "2-digit", month: "short", year: "numeric",
                      timeZone: "Asia/Kolkata",
                  })
                : "—";
            const depTime  = schedule.departureTime || "—";
            const arrTime  = schedule.arrivalTime   || "—";

            const bookedAtStr = bookedAt
                ? new Date(bookedAt).toLocaleString("en-IN", {
                      dateStyle: "medium", timeStyle: "short",
                      timeZone: "Asia/Kolkata",
                  })
                : "—";

            // ── Create PDF document ───────────────────────────────────────────
            const doc = new PDFDocument({
                size: "A4",
                margin: 0,
                info: {
                    Title:    `Payanam Ticket — ${bookingId}`,
                    Author:   "Payanam",
                    Subject:  `Bus ticket from ${source} to ${destination}`,
                    Keywords: "bus ticket travel payanam",
                },
            });

            const chunks = [];
            doc.on("data", (chunk) => chunks.push(chunk));
            doc.on("end",  ()      => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            const W = 595.28; // A4 width in points
            const M = 36;     // left/right margin

            // ── BACKGROUND ────────────────────────────────────────────────────
            doc.rect(0, 0, W, 841.89).fill(C.darkBg);

            // ── HEADER GRADIENT (simulate with dark navy rect) ────────────────
            doc.rect(0, 0, W, 140).fill(C.navy);

            // Brand title
            doc
                .fillColor(C.gold)
                .fontSize(28)
                .font("Helvetica-Bold")
                .text("🎟 Payanam", M, 34, { align: "center", width: W - M * 2 });

            // Status badge
            const badgeColor  = bookingStatus === "CONFIRMED" ? C.green : C.red;
            const badgeText   = bookingStatus === "CONFIRMED" ? "✓  BOOKING CONFIRMED" : "✕  BOOKING CANCELLED";

            roundedRect(doc, W / 2 - 110, 80, 220, 30, 6, badgeColor);
            doc
                .fillColor(C.white)
                .fontSize(12)
                .font("Helvetica-Bold")
                .text(badgeText, W / 2 - 110, 89, { width: 220, align: "center" });

            // ── PNR + FARE STRIP ──────────────────────────────────────────────
            roundedRect(doc, M, 158, W - M * 2, 60, 8, C.cardBg);

            doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("BOOKING REFERENCE", M + 16, 168);
            doc.fillColor(C.gold).fontSize(22).font("Helvetica-Bold").text(bookingId, M + 16, 179);

            doc.fillColor(C.muted).fontSize(8).font("Helvetica");
            textRight(doc, "TOTAL FARE", M, 168, W - M * 2 - 16);
            doc.fillColor(C.green).fontSize(22).font("Helvetica-Bold");
            textRight(doc, `\u20B9${totalFare}`, M, 179, W - M * 2 - 16);

            // ── ROUTE CARD ────────────────────────────────────────────────────
            let y = 238;
            roundedRect(doc, M, y, W - M * 2, 90, 8, C.cardBg);

            // From
            doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("FROM", M + 16, y + 12);
            doc.fillColor(C.text).fontSize(18).font("Helvetica-Bold").text(source, M + 16, y + 24);
            doc.fillColor(C.gold).fontSize(10).font("Helvetica")
                .text(`${boardingPoint.name || "—"}  •  ${depTime}`, M + 16, y + 46);

            // Arrow divider
            doc.fillColor(C.muted).fontSize(18).font("Helvetica").text("→", W / 2 - 12, y + 30);

            // To
            doc.fillColor(C.muted).fontSize(8).font("Helvetica");
            textRight(doc, "TO", M, y + 12, W - M * 2 - 16);
            doc.fillColor(C.text).fontSize(18).font("Helvetica-Bold");
            textRight(doc, destination, M, y + 24, W - M * 2 - 16);
            doc.fillColor(C.gold).fontSize(10).font("Helvetica");
            textRight(doc, `${droppingPoint.name || "—"}  •  ${arrTime}`, M, y + 46, W - M * 2 - 16);

            // ── BUS & DATE CARDS (side by side) ───────────────────────────────
            y += 108;
            const halfW = (W - M * 2 - 12) / 2;

            // Bus card
            roundedRect(doc, M, y, halfW, 70, 8, C.cardBg);
            doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("BUS", M + 14, y + 12);
            doc.fillColor(C.text).fontSize(13).font("Helvetica-Bold").text(busName, M + 14, y + 24, { width: halfW - 28 });
            doc.fillColor(C.subtext).fontSize(10).font("Helvetica")
                .text(`${busNumber}  •  ${busType}`, M + 14, y + 42, { width: halfW - 28 });

            // Date card
            const x2 = M + halfW + 12;
            roundedRect(doc, x2, y, halfW, 70, 8, C.cardBg);
            doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("DEPARTURE", x2 + 14, y + 12);
            doc.fillColor(C.text).fontSize(13).font("Helvetica-Bold").text(depDate, x2 + 14, y + 24);
            doc.fillColor(C.gold).fontSize(10).font("Helvetica")
                .text(`${depTime}  →  ${arrTime}`, x2 + 14, y + 42);

            // ── PASSENGER TABLE ───────────────────────────────────────────────
            y += 86;
            doc.fillColor(C.muted).fontSize(8).font("Helvetica").text("PASSENGERS", M, y + 4);
            y += 18;

            // Table header
            roundedRect(doc, M, y, W - M * 2, 26, 6, C.navy);
            const cols = { name: M + 14, seat: M + 220, age: M + 290, gender: M + 360 };

            doc.fillColor(C.muted).fontSize(8).font("Helvetica-Bold")
                .text("NAME",   cols.name,   y + 9)
                .text("SEAT",   cols.seat,   y + 9)
                .text("AGE",    cols.age,    y + 9)
                .text("GENDER", cols.gender, y + 9);

            y += 26;
            passengerDetails.forEach((p, i) => {
                const rowBg = i % 2 === 0 ? C.cardBg : "#16163a";
                doc.rect(M, y, W - M * 2, 26).fill(rowBg);

                doc.fillColor(C.text).fontSize(10).font("Helvetica")
                    .text(p.name,   cols.name,   y + 8, { width: 180 })
                    .text(p.seatNumber || bookedSeats[i] || "—", cols.seat, y + 8)
                    .text(String(p.age),    cols.age,    y + 8)
                    .text(p.gender,  cols.gender, y + 8);

                y += 26;
            });

            // ── BOOKING META ──────────────────────────────────────────────────
            y += 16;
            roundedRect(doc, M, y, W - M * 2, 56, 8, C.cardBg);

            doc.fillColor(C.muted).fontSize(8).font("Helvetica")
                .text("BOOKED AT",         M + 14, y + 10)
                .text("PASSENGER",         M + 200, y + 10);

            doc.fillColor(C.subtext).fontSize(10).font("Helvetica")
                .text(bookedAtStr,         M + 14,  y + 22, { width: 160 })
                .text(userName,            M + 200, y + 22, { width: 160 });

            if (paymentReference) {
                doc.fillColor(C.muted).fontSize(8).font("Helvetica")
                    .text("PAYMENT REF",    M + 14, y + 36);
                doc.fillColor(C.subtext).fontSize(9).font("Helvetica")
                    .text(paymentReference, M + 14, y + 46, { width: W - M * 2 - 28 });
                y += 14; // expand for payment ref line
            }

            // ── DASHED DIVIDER ────────────────────────────────────────────────
            y += 72;
            doc
                .moveTo(M, y)
                .lineTo(W - M, y)
                .dash(4, { space: 4 })
                .strokeColor(C.border)
                .stroke()
                .undash();

            // ── FOOTER ────────────────────────────────────────────────────────
            y += 12;
            doc.fillColor(C.muted).fontSize(8).font("Helvetica")
                .text(
                    "Please carry a valid government-issued photo ID. This ticket is non-transferable. " +
                    "For support contact: payanamapplication@gmail.com",
                    M, y,
                    { width: W - M * 2, align: "center" }
                );

            doc.fillColor(C.gold).fontSize(9).font("Helvetica-Bold")
                .text("🚌  Safe Travels with Payanam!", M, y + 18, {
                    width: W - M * 2, align: "center",
                });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
