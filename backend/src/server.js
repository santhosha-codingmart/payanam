import app from "./app.js";
import dotenv from "dotenv";
import connectDB  from "./config/db.js";
import mongoose from "mongoose";

dotenv.config();
connectDB();

app.listen(process.env.PORT,()=>{
    console.log(`The server is running at the port: ${process.env.PORT}`);
});

console.log(process.pid);