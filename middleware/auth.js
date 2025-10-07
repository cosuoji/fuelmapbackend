// src/middleware/auth.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from header: "Authorization: Bearer <token>"
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Verify and decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request (excluding password)
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
