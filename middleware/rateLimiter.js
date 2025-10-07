import rateLimit from "express-rate-limit";

// General API limiter (per IP)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 requests per IP
  message: { error: "Too many requests, please try again later." }
});

// Price submission limiter (tighter)
export const priceLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Max 5 submissions per 10 mins per IP
  message: { error: "Too many price updates, slow down." }
});
