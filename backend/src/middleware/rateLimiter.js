const rateLimit = require("express-rate-limit");

const ttsRateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limited",
    message: "Too many voice generation requests. Please wait a moment and try again.",
  },
});

module.exports = { ttsRateLimiter };
