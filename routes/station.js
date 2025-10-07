// src/routes/station.js
import express from "express";
import Station from "../models/Station.js";
import { authMiddleware } from "../middleware/auth.js";
import { validatePriceSubmission } from "../middleware/priceValidator.js";
import { priceLimiter } from "../middleware/rateLimiter.js";
import { adminMiddleware } from "../middleware/admin.js";
import { handlePostSubmission } from "../utils/reputation.js";
import { handleAdminApproval, handleAdminRejection } from "../utils/reputation.js";
import axios from "axios"; // use Google Maps or OpenStreetMap API





const router = express.Router();


// 🔍 Search for stations by name + address proximity
router.get("/search", async (req, res) => {
  const { q, address } = req.query;

  if (!q && !address) {
    return res.status(400).json({ error: "Missing search query" });
  }

  try {
    // 1️⃣ Search your database
    const local = await Station.find({
      $or: [
        { name: new RegExp(q, "i") },
        { address: new RegExp(address?.split(",")[0] || "", "i") },
      ],
    })
      .limit(5)
      .lean();

    // 2️⃣ External search (Nominatim / OpenStreetMap)
    const externalRes = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: `${q} ${address}`,
          format: "json",
          limit: 5,
        },
        headers: { "User-Agent": "FuelMap/1.0" },
      }
    );

    const external = externalRes.data.map((s) => ({
      name: s.display_name.split(",")[0],
      address: s.display_name,
      lat: s.lat,
      lon: s.lon,
      source: "external",
    }));

    res.json({ local, external });
  } catch (err) {
    console.error("❌ Error in /stations/search:", err.message);
    res.status(500).json({ error: "Search failed" });
  }
});


// Add/update fuel price

router.post(
  "/add-price",
  authMiddleware,
  validatePriceSubmission,
  priceLimiter,
  async (req, res) => {
    try {
      const { name, address, fuelType, price, queueStatus } = req.body;

      if (!name || !address || !price) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // ✅ 1. Get full geocoded address & coordinates
      const geoResponse = await axios.get(
        "https://nominatim.openstreetmap.org/search",
        {
          params: { q: address, format: "json", limit: 1 },
          headers: { "User-Agent": "FuelMap/1.0" },
        }
      );

      if (!geoResponse.data.length) {
        return res
          .status(400)
          .json({ error: "Could not find a valid location for that address" });
      }

      const { lat, lon, display_name } = geoResponse.data[0];

      // ✅ 2. Try to find existing station by name near that coordinate
    // ✅ 2. Try to find existing station by name or nearby address
        let station = await Station.findOne({
          $and: [
            {
              location: {
                $nearSphere: {
                  $geometry: {
                    type: "Point",
                    coordinates: [parseFloat(lon), parseFloat(lat)],
                  },
                  $maxDistance: 300, // within ~300 meters
                },
              },
            },
            {
              $or: [
                { name: new RegExp(name, "i") }, // fuzzy name match
                { address: new RegExp(address.split(",")[0], "i") }, // partial address match
              ],
            },
          ],
        });


      let createdStation = false;

      // ✅ 3. If none found, create new station
      if (!station) {
        station = new Station({
          name,
          address: display_name || address,
          location: { type: "Point", coordinates: [parseFloat(lon), parseFloat(lat)] },
          prices: [],
        });
        createdStation = true;
      }

      // ✅ 4. Enforce rate limit per user/station
      const lastUpdate = station.prices
        .filter((p) => p.updatedBy?.toString() === req.user.id)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];

      if (
        lastUpdate &&
        Date.now() - new Date(lastUpdate.updatedAt).getTime() < 10 * 60 * 1000
      ) {
        return res
          .status(429)
          .json({ error: "You can only update this station every 10 minutes." });
      }

      // ✅ 5. Add new price record
      const newPrice = {
        fuelType,
        price: parseFloat(price),
        queueStatus,
        updatedBy: req.user.id,
        updatedAt: new Date(),
        status: "approved",
        flagged: false,
      };
      station.prices.push(newPrice);

      // ✅ 6. Detect suspicious deviation
      const pastPrices = station.prices
        .filter((p) => p.fuelType === fuelType && p.status === "approved")
        .slice(-6, -1);

      if (pastPrices.length > 0) {
        const avg =
          pastPrices.reduce((sum, p) => sum + p.price, 0) / pastPrices.length;
        const latest = station.prices[station.prices.length - 1];

        if (price > avg * 1.3 || price < avg * 0.7) {
          latest.flagged = true;
          latest.status = "pending";
          latest.statusReason = `Suspicious: ₦${price}, avg ~₦${avg.toFixed(2)}`;
        }
      }

      await station.save();

      // ✅ 7. Update user reputation
      await handlePostSubmission(req.user.id, { createdStation });

      res.json({
        message: "✅ Price submitted successfully",
        station,
      });
    } catch (err) {
      console.error("❌ Error in /add-price:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);




// Get nearby stations
router.get("/nearby", async (req, res) => {
  const { lng, lat, maxDistance = 5000 } = req.query;
  const stations = await Station.find({
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
        $maxDistance: parseInt(maxDistance)
      }
    }
  }).limit(20);

  res.json(stations);
});

router.get("/admin/pending", authMiddleware, adminMiddleware, async (req, res) => {
  const stations = await Station.find({ "prices.status": "pending" });
  res.json(stations);
});

router.post("/admin/review", authMiddleware, adminMiddleware, async (req, res) => {
  const { stationId, priceId, action } = req.body; // action = "approve" | "reject"



  const station = await Station.findById(stationId);
  if (!station) return res.status(404).json({ error: "Station not found" });

  const priceEntry = station.prices.id(priceId);
  if (!priceEntry) return res.status(404).json({ error: "Price entry not found" });

  priceEntry.status = action === "approve" ? "approved" : "rejected";

    if (action === "approve") {
  priceEntry.status = "approved";
  priceEntry.flagged = false;
  priceEntry.statusReason = null;
  await station.save();

  // reward submitter
  await handleAdminApproval(priceEntry.updatedBy);
} else if (action === "reject") {
  priceEntry.status = "rejected";
  await station.save();

  // penalize submitter
  await handleAdminRejection(priceEntry.updatedBy);
}

  await station.save();

  res.json({ message: `Price update ${action}d`, station });
});


router.post("/report-price", authMiddleware, async (req, res) => {
  try {
    const { stationId, priceId } = req.body;

    const station = await Station.findById(stationId);
    if (!station) return res.status(404).json({ error: "Station not found" });

    const priceEntry = station.prices.id(priceId);
    if (!priceEntry) return res.status(404).json({ error: "Price entry not found" });

    // Prevent double voting
    if (priceEntry.downvotes.some(u => u.toString() === req.user.id)) {
      return res.status(400).json({ error: "You already reported this price." });
    }

    priceEntry.downvotes.push(req.user.id);

    // Auto-flag if too many reports (e.g. 3+)
    if (priceEntry.downvotes.length >= 3) {
      priceEntry.status = "pending";
      priceEntry.flagged = true;
      priceEntry.statusReason = "Flagged by community downvotes";
    }

    await station.save();
    res.json({ message: "Price reported", price: priceEntry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all stations (no distance filter)
// Get all stations with pagination + filters
router.get("/all", async (req, res) => {
  try {
    const { page = 1, limit = 20, fuelType, minPrice, maxPrice, name } = req.query;

    const query = {};

    // Optional text search by station name
    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    // Filter by fuelType + price ranges inside prices array
    if (fuelType || minPrice || maxPrice) {
      query.prices = {
        $elemMatch: {
          ...(fuelType ? { fuelType } : {}),
          ...(minPrice ? { price: { $gte: Number(minPrice) } } : {}),
          ...(maxPrice ? { price: { $lte: Number(maxPrice) } } : {}),
        },
      };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const stations = await Station.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Station.countDocuments(query);

    res.json({
      stations,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default router;
