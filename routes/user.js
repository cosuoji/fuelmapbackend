import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import User from "../models/User.js";
import { BADGE_DEFS } from "../config/badges.js";

const router = express.Router();

/**
 * GET /api/users/me/badges
 * Authenticated user’s badges
 */
router.get("/me/badges", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("badges trustLevel reputation");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      trustLevel: user.trustLevel,
      reputation: user.reputation,
      badges: user.badges
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/users/:id/badges
 * Public user badge view
 */
router.get("/:id/badges", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("badges trustLevel reputation");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      trustLevel: user.trustLevel,
      reputation: user.reputation,
      badges: user.badges
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/badges
 * All possible badge definitions
 */
router.get("/all/definitions", (req, res) => {
  res.json(BADGE_DEFS);
});

export default router;
