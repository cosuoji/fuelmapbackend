import { body, validationResult } from "express-validator";

export const validatePriceSubmission = [
  body("fuelType").isIn(["PMS", "AGO", "LPG"]).withMessage("Invalid fuel type"),
  body("price").isFloat({ min: 50, max: 2000 }).withMessage("Invalid price range"),
  body("queueStatus").isIn(["no-queue", "short", "long"]).withMessage("Invalid queue status"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];
