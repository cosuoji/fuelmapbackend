// src/routes/auth.js
import express from "express";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../middleware/auth.js";


const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const user = await User.create(req.body);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (err) {
    console.error("Registration error:", err.message);

    if (err.code === 11000) {
      return res.status(400).json({
        error: "Email already exists. Please use a different email address.",
      });
    }

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(", ") });
    }

    res.status(500).json({
      error: "Something went wrong while registering. Please try again later.",
    });
  }
});



// Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ message: "Login successful", token, user });
});

// src/routes/auth.js
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



export default router;
