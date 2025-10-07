import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

/**
 * Middleware: Admin check
 */
const adminOnly = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  next();
};

/**
 * GET /api/admin/users
 * Returns all registered users
 */
router.get("/users", authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select("_id email isAdmin badges createdAt")
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

/**
 * PATCH /api/admin/users/:id/add-badge
 * Adds a badge to a user
 */
router.patch("/users/:id/add-badge", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { badge } = req.body;
    if (!badge) return res.status(400).json({ error: "Badge is required" });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { badges: badge } }, // prevents duplicates
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error adding badge:", err);
    res.status(500).json({ error: "Server error adding badge" });
  }
});

/**
 * PATCH /api/admin/users/:id/remove-badge
 * Removes a badge from a user
 */
router.patch("/users/:id/remove-badge", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { badge } = req.body;
    if (!badge) return res.status(400).json({ error: "Badge is required" });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { badges: badge } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error removing badge:", err);
    res.status(500).json({ error: "Server error removing badge" });
  }
});

export default router;
