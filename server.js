// src/server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import stationRoutes from "./routes/station.js";
import userRoutes from "./routes/user.js";
import feedbackRoutes from "./routes/feedback.js";


import { apiLimiter } from "./middleware/rateLimiter.js";




dotenv.config();
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim())
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, // 👈 allow cookies / auth headers
  })
);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/api/", apiLimiter); // apply to all API routes
app.use("/api/auth", authRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/feedback", feedbackRoutes);


mongoose.connect(process.env.MONGO_URI)
  .then(()=> app.listen(process.env.PORT || 4000, () =>
    console.log(`Server running on port ${process.env.PORT || 4000}`)
  ))
  .catch(err => console.error("Mongo error:", err));
