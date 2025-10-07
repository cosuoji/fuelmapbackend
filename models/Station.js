// src/models/Station.js
import mongoose from "mongoose";

const priceSchema = new mongoose.Schema({
  fuelType: { 
    type: String, 
    enum: ["PMS", "AGO", "LPG"], 
    required: true 
  },
  price: { 
    type: Number, 
    required: true, 
    min: [50, "Price must be at least ₦50"],
    max: [2000, "Price must be less than ₦2000"]
  },
  queueStatus: {
    type: String,
    enum: ["no queue", "short", "long"],
    default: "no queue"
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedAt: { type: Date, default: Date.now },

  // ✅ Admin / moderation fields
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
  flagged: { type: Boolean, default: false },
  statusReason: { type: String, default: null },

  // ✅ Community reporting
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
});

const stationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String }, // ✅ add this
  location: {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: { type: [Number], required: true },
  },
  prices: [priceSchema],
});

// Enable geospatial queries
stationSchema.index({ location: "2dsphere" });

export default mongoose.model("Station", stationSchema);
