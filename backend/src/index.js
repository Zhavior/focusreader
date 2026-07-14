require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const ttsRoutes = require("./routes/tts.routes");
const extensionRoutes = require("./routes/extension.routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4000;

// Behind a reverse proxy (Caddy/nginx) in production: trust X-Forwarded-For
// so the rate limiter keys on real client IPs, not the proxy's.
if (process.env.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

// Mount JSON parser first so req.body is available for extension routes
app.use(express.json({ limit: "2mb" }));

// Extension routes can be called from any web origin (e.g. foxsports.com content scripts)
app.use(
  "/api/extension",
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  extensionRoutes
);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  })
);

app.use("/api/tts", ttsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "Route not found." });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Voice Agent backend listening on http://localhost:${PORT}`);
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn(
      "WARNING: ELEVENLABS_API_KEY is not set. Voice generation requests will fail until it is configured in backend/.env"
    );
  }
});
