import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// Create a new Redis instance.
// By default, it connects to localhost:6379, which is perfect for your local installation.
const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
});

// We attach "listeners" to verify everything is working
redis.on("connect", () => {
    console.log("Redis connected....");
});

redis.on("error", (error) => {
    console.error("Redis connection error:", error.message);
});

export default redis;
