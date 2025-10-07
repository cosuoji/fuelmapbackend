// src/routes/adminStations.js
import express from "express";
import Station from "../models/Station.js";
import { authMiddleware } from "../middleware/auth.js";
import { adminMiddleware } from "../middleware/admin.js";

const router = express.Router();

/**
 * GET /api/admin/stations
 * List all stations
 */
router.get("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const stations = await Station.find().sort({ createdAt: -1 });
    res.json(stations);
  } catch (err) {
    console.error("Error fetching stations:", err);
    res.status(500).json({ error: "Server error fetching stations" });
  }
});

/**
 * POST /api/admin/stations
 * Add a new station manually
 */
router.post("/", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, location } = req.body;
    if (!name || !location) {
      return res.status(400).json({ error: "Name and location are required" });
    }

    const station = new Station({
      name,
      address: location,
      location: {
        type: "Point",
        coordinates: [0, 0], // optional, you could geocode this later
      },
      prices: [],
    });

    await station.save();
    res.status(201).json(station);
  } catch (err) {
    console.error("Error adding station:", err);
    res.status(500).json({ error: "Server error adding station" });
  }
});

/**
 * DELETE /api/admin/stations/:id
 * Delete a station
 */
router.delete("/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const station = await Station.findByIdAndDelete(req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found" });
    res.json({ message: "Station deleted successfully" });
  } catch (err) {
    console.error("Error deleting station:", err);
    res.status(500).json({ error: "Server error deleting station" });
  }
});

/**
 * PATCH /api/admin/stations/:id/price
 * Edit price or queue status manually
 */
router.patch("/:id/price", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { fuelType, price, queueStatus } = req.body;
    if (!fuelType || !price) {
      return res.status(400).json({ error: "Fuel type and price required" });
    }

    const station = await Station.findById(req.params.id);
    if (!station) return res.status(404).json({ error: "Station not found" });

    station.prices.push({
      fuelType,
      price,
      queueStatus,
      updatedBy: req.user.id,
      updatedAt: new Date(),
      status: "approved",
      flagged: false,
    });

    await station.save();
    res.json({ message: "Price updated successfully", station });
  } catch (err) {
    console.error("Error updating price:", err);
    res.status(500).json({ error: "Server error updating price" });
  }
});

/**
 * GET /api/admin/stations/flagged
 * View stations with flagged or downvoted prices
 */
router.get("/flagged", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const flagged = await Station.find({
      $or: [
        { "prices.flagged": true },
        { "prices.downvotes.0": { $exists: true } },
      ],
    });
    res.json(flagged);
  } catch (err) {
    console.error("Error fetching flagged stations:", err);
    res.status(500).json({ error: "Server error fetching flagged stations" });
  }
});

export default router;
