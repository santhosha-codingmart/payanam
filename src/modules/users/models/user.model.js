import mongoose from "mongoose";

let userSchema = mongoose.Schema({
    name: {
        type: String,
        trim: true,
        sparse: true
    },

    age: {
        type: Number,
        trim: true,
        sparse: true
    },

    email: {
        type: String,
        sparse: true,
        trim: true,
        unique: true
    },

    phoneNo: {
        type: String,
        sparse: true,
        trim: true,
        unique: true
    },

    isEmailVerified: {
        type: Boolean,
        default: false
    },

    isPhoneVerified: {
        type: Boolean,
        default: false
    },

    password: {
        type: String
    },

    role: {
        type: String,
        enum: ["user", "vendor", "admin"],
        default: "user"
    },

    // ── Vendor-only fields ───────────────────────────────────────────────────
    // Only populated when role === "vendor". Optional so regular users are
    // not affected. companyName is the trading name shown to passengers;
    // gstNumber is needed for tax invoicing.
    companyName: {
        type: String,
        trim: true,
        sparse: true
    },

    gstNumber: {
        type: String,
        trim: true,
        uppercase: true,
        sparse: true,
        // Standard Indian GST format: 2-digit state code + PAN + entity type + Z + check
        match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GST number format"]
    },

    // ── Profile Image ─────────────────────────────────────────────────────────
    profileImage: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);
export default User;