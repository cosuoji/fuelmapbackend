import express from "express";
import Feedback from "../models/Feedback.js";

const router = express.Router();

// POST /api/feedback — Submit feedback
router.post("/", async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const feedback = new Feedback({ name, email, message });
    await feedback.save();

    res.status(201).json({ message: "Feedback submitted successfully" });
  } catch (error) {
    console.error("Feedback submission failed:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
