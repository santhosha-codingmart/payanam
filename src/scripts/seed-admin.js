// =============================================================================
// Seed Script — Create initial admin user
//
// Run once:  node src/scripts/seed-admin.js
//
// Creates an admin account with credentials from .env:
//   ADMIN_EMAIL    (default: admin@payanam.com)
//   ADMIN_PASSWORD (default: Admin@123)
//
// Safe to run multiple times — uses upsert, won't duplicate.
// =============================================================================

import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../modules/users/models/user.model.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("MONGO_URI is not set in .env");
    process.exit(1);
}

const adminEmail    = process.env.ADMIN_EMAIL    || "admin@payanam.com";
const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
const adminName     = process.env.ADMIN_NAME     || "Payanam Admin";

(async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected.");

        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            // If already admin, just confirm
            if (existingAdmin.role === "admin") {
                console.log(`Admin already exists: ${adminEmail}`);
            } else {
                // Promote existing user to admin
                existingAdmin.role = "admin";
                existingAdmin.isActive = true;
                await existingAdmin.save();
                console.log(`User ${adminEmail} promoted to admin.`);
            }
        } else {
            const hashedPassword = await bcrypt.hash(adminPassword, 12);
            await User.create({
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                role: "admin",
                isEmailVerified: true,
                isActive: true,
            });
            console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
        }

        await mongoose.disconnect();
        console.log("Done.");
        process.exit(0);
    } catch (err) {
        console.error("Seed failed:", err);
        process.exit(1);
    }
})();
