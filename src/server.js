import app from "./app.js";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import "./config/redis.js";
import { bulkUpsertCities, initCityCache } from "./modules/places/services/city.service.js";
import { bulkUpsertAirports, initAirportCache } from "./modules/flights/services/airport.service.js";
import { createRequire } from "module";

dotenv.config();

// ── Startup sequence ─────────────────────────────────────────────────────────
// We must connect to DB first, then seed cities, then start listening.
// This ensures the Fuse.js index is warm before the first request arrives.
const require = createRequire(import.meta.url);

async function start() {
    await connectDB();
    await initAirportCache();

    // ── Seed cities from JSON on first boot ──────────────────────────────────
    // The cities.json file contains 1200+ Indian cities fetched from an open
    // dataset. On every startup we bulk-upsert them into MongoDB.
    //
    // WHY ON EVERY STARTUP?
    //   upsert = insert if not exists, skip if already there.
    //   So re-running this is always safe and idempotent. It adds any cities
    //   from the JSON that aren't in DB yet (e.g. after a JSON update).
    //   It does NOT overwrite popularity scores earned from route registrations.
    try {
        const citiesJson = require("./modules/places/data/cities.json");
        // cities.json is an array of city name strings — we need state info.
        // Since the JSON only has names, we use a state lookup map.
        // For cities whose state is unknown, we default to "India" (better than nothing).
        const STATE_MAP = {
            // Tamil Nadu
            "Chennai": "Tamil Nadu", "Coimbatore": "Tamil Nadu", "Madurai": "Tamil Nadu",
            "Salem": "Tamil Nadu", "Erode": "Tamil Nadu", "Tiruppur": "Tamil Nadu",
            "Tirunelveli": "Tamil Nadu", "Trichy": "Tamil Nadu", "Villupuram": "Tamil Nadu",
            "Kanyakumari": "Tamil Nadu", "Dharapuram": "Tamil Nadu", "Sivagangai": "Tamil Nadu",
            "Dindigul": "Tamil Nadu", "Thanjavur": "Tamil Nadu", "Vellore": "Tamil Nadu",
            "Ramagundam": "Tamil Nadu", "Tiruvottiyur": "Tamil Nadu", "Nagercoil": "Tamil Nadu",
            "Thoothukudi": "Tamil Nadu", "Tiruvannamalai": "Tamil Nadu",
            // Karnataka
            "Bangalore": "Karnataka", "Bengaluru": "Karnataka", "Mysore": "Karnataka",
            "Hubli-Dharwad": "Karnataka", "Mangalore": "Karnataka", "Belgaum": "Karnataka",
            "Davanagere": "Karnataka", "Bellary": "Karnataka", "Gulbarga": "Karnataka",
            "Shivamogga": "Karnataka", "Tumkur": "Karnataka", "Bijapur": "Karnataka",
            // Andhra Pradesh / Telangana
            "Hyderabad": "Telangana", "Visakhapatnam": "Andhra Pradesh",
            "Vijayawada": "Andhra Pradesh", "Guntur": "Andhra Pradesh",
            "Nellore": "Andhra Pradesh", "Kurnool": "Andhra Pradesh",
            "Rajahmundry": "Andhra Pradesh", "Kakinada": "Andhra Pradesh",
            "Nizamabad": "Telangana", "Khammam": "Telangana",
            "Karimnagar": "Telangana", "Warangal": "Telangana",
            "Anantapur": "Andhra Pradesh", "Tenali": "Andhra Pradesh",
            "Eluru": "Andhra Pradesh", "Vijayanagaram": "Andhra Pradesh",
            // Maharashtra
            "Mumbai": "Maharashtra", "Pune": "Maharashtra", "Nagpur": "Maharashtra",
            "Nashik": "Maharashtra", "Thane": "Maharashtra", "Aurangabad": "Maharashtra",
            "Solapur": "Maharashtra", "Amravati": "Maharashtra", "Nanded": "Maharashtra",
            "Kolhapur": "Maharashtra", "Jalgaon": "Maharashtra", "Malegaon": "Maharashtra",
            "Dhule": "Maharashtra", "Jalna": "Maharashtra", "Chandrapur": "Maharashtra",
            "Latur": "Maharashtra", "Parbhani": "Maharashtra", "Bhiwandi": "Maharashtra",
            "Navi Mumbai": "Maharashtra", "Pimpri-Chinchwad": "Maharashtra",
            "Vasai-Virar": "Maharashtra", "Ahmednagar": "Maharashtra",
            "Satara": "Maharashtra", "Ichalkaranji": "Maharashtra", "Ambernath": "Maharashtra",
            "Ulhasnagar": "Maharashtra", "Bhilwara": "Maharashtra",
            // Gujarat
            "Ahmedabad": "Gujarat", "Surat": "Gujarat", "Vadodara": "Gujarat",
            "Rajkot": "Gujarat", "Bhavnagar": "Gujarat", "Jamnagar": "Gujarat",
            "Junagadh": "Gujarat", "Gandhidham": "Gujarat",
            // Delhi / NCR
            "Delhi": "Delhi", "New Delhi": "Delhi", "Noida": "Uttar Pradesh",
            "Ghaziabad": "Uttar Pradesh", "Faridabad": "Haryana", "Gurgaon": "Haryana",
            // Uttar Pradesh
            "Lucknow": "Uttar Pradesh", "Kanpur": "Uttar Pradesh", "Agra": "Uttar Pradesh",
            "Varanasi": "Uttar Pradesh", "Allahabad": "Uttar Pradesh", "Meerut": "Uttar Pradesh",
            "Bareilly": "Uttar Pradesh", "Moradabad": "Uttar Pradesh",
            "Saharanpur": "Uttar Pradesh", "Gorakhpur": "Uttar Pradesh",
            "Aligarh": "Uttar Pradesh", "Jodhpur": "Rajasthan",
            "Firozabad": "Uttar Pradesh", "Mathura": "Uttar Pradesh",
            "Rampur": "Uttar Pradesh", "Shahjahanpur": "Uttar Pradesh",
            "Budaun": "Uttar Pradesh", "Hapur": "Uttar Pradesh",
            "Bulandshahr": "Uttar Pradesh", "Etawah": "Uttar Pradesh",
            "Mau": "Uttar Pradesh", "Farrukhabad": "Uttar Pradesh",
            "Mirzapur": "Uttar Pradesh", "Banda": "Uttar Pradesh",
            "Akbarpur": "Uttar Pradesh",
            // Rajasthan
            "Jaipur": "Rajasthan", "Udaipur": "Rajasthan", "Kota": "Rajasthan",
            "Bikaner": "Rajasthan", "Ajmer": "Rajasthan", "Bharatpur": "Rajasthan",
            "Alwar": "Rajasthan", "Sikar": "Rajasthan", "Pali": "Rajasthan",
            "Sri Ganganagar": "Rajasthan", "Ratlam": "Madhya Pradesh",
            // Madhya Pradesh
            "Bhopal": "Madhya Pradesh", "Indore": "Madhya Pradesh",
            "Jabalpur": "Madhya Pradesh", "Gwalior": "Madhya Pradesh",
            "Ujjain": "Madhya Pradesh", "Sagar": "Madhya Pradesh",
            "Dewas": "Madhya Pradesh", "Satna": "Madhya Pradesh",
            "Rewa": "Madhya Pradesh", "Murwara": "Madhya Pradesh",
            "Jhansi": "Madhya Pradesh",
            // West Bengal
            "Kolkata": "West Bengal", "Howrah": "West Bengal",
            "Durgapur": "West Bengal", "Asansol": "West Bengal",
            "Siliguri": "West Bengal", "Baranagar": "West Bengal",
            "North Dumdum": "West Bengal", "South Dumdum": "West Bengal",
            "Uluberia": "West Bengal", "Bhatpara": "West Bengal",
            "Panihati": "West Bengal", "Kamarhati": "West Bengal",
            "Rajpur Sonarpur": "West Bengal", "Haldia": "West Bengal",
            "Barasat": "West Bengal", "Bally": "West Bengal",
            "Maheshtala": "West Bengal", "Bardhaman": "West Bengal",
            "Kulti": "West Bengal",
            // Bihar
            "Patna": "Bihar", "Gaya": "Bihar", "Bhagalpur": "Bihar",
            "Muzaffarpur": "Bihar", "Arrah": "Bihar", "Purnia": "Bihar",
            "Begusarai": "Bihar", "Bihar Sharif": "Bihar", "Katihar": "Bihar",
            "Darbhanga": "Bihar",
            // Jharkhand
            "Ranchi": "Jharkhand", "Jamshedpur": "Jharkhand",
            "Dhanbad": "Jharkhand", "Bokaro": "Jharkhand",
            "Rourkela": "Odisha",
            // Odisha
            "Bhubaneswar": "Odisha", "Cuttack": "Odisha",
            "Berhampur": "Odisha", "Sambalpur": "Odisha",
            // Punjab / Haryana / HP
            "Ludhiana": "Punjab", "Amritsar": "Punjab", "Jalandhar": "Punjab",
            "Bathinda": "Punjab", "Patiala": "Punjab",
            "Chandigarh": "Chandigarh", "Rohtak": "Haryana",
            "Sonipat": "Haryana", "Panipat": "Haryana", "Karnal": "Haryana",
            "Dehradun": "Uttarakhand", "Haridwar": "Uttarakhand",
            // J&K / North-East
            "Srinagar": "Jammu & Kashmir", "Jammu": "Jammu & Kashmir",
            "Guwahati": "Assam", "Silchar": "Assam", "Bongaigaon": "Assam",
            "Imphal": "Manipur", "Aizawl": "Mizoram", "Agartala": "Tripura",
            // Chhattisgarh
            "Raipur": "Chhattisgarh", "Bhilai": "Chhattisgarh",
            "Durg": "Chhattisgarh", "Bilaspur": "Chhattisgarh",
            "Korba": "Chhattisgarh",
            // Kerala
            "Kochi": "Kerala", "Thiruvananthapuram": "Kerala",
            "Kozhikode": "Kerala", "Thrissur": "Kerala",
            "Kollam": "Kerala",
            // Pondicherry
            "Pondicherry": "Puducherry", "Ozhukarai": "Puducherry",
            // Others
            "Raichur": "Karnataka", "Loni": "Uttar Pradesh",
            "Karawal Nagar": "Delhi", "Mango": "Jharkhand",
            "Kirari Suleman Nagar": "Delhi",
            "Gopalpur": "Odisha",
        };

        const citiesPayload = citiesJson.map((name) => ({
            name,
            state: STATE_MAP[name] || "India",
        }));

        await bulkUpsertCities(citiesPayload);
        console.log(`🌆 Cities seeded successfully from JSON`);
    } catch (err) {
        console.error("[Startup] City seed warning:", err.message);
        await initCityCache();
    }

    try {
        const airportsJson = require("./modules/flights/data/airports.json");
        await bulkUpsertAirports(airportsJson);
        console.log(`✈️  Airports seeded successfully from JSON`);
    } catch (err) {
        console.error("[Startup] Airport seed warning:", err.message);
        await initAirportCache();
    }

    app.listen(process.env.PORT, () => {
        console.log(`The server is running at the port: ${process.env.PORT}`);
    });
}

start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});

console.log(process.pid);
//huyyuffyu