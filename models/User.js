// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const badgeSchema = new mongoose.Schema({
  key: { type: String, required: true }, // unique key, e.g. "first_submission"
  name: String,
  description: String,
  awardedAt: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

const reputationHistorySchema = new mongoose.Schema({
  change: Number,
  reason: String,
  date: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  reputation: { type: Number, default: 0 }, 
  contributions: { type: Number, default: 0 },            // total submissions
  verifiedContributions: { type: Number, default: 0 },    // admin-approved submissions
  badges: { type: [badgeSchema], default: [] },
  trustLevel: { type: String, default: "Newbie" },        // computed
  reputationHistory: { type: [reputationHistorySchema], default: [] },
  createdAt: { type: Date, default: Date.now },
   isAdmin: { type: Boolean, default: false },   // <--- NEW
});


// Hash password before save
userSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare passwords
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
