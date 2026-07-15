require("dotenv").config();

// Day 1: Strict startup fail-fast validation before anything else initializes
const { config } = require("./config/env");
const { logger } = require("./observability/logger");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const ttsRoutes = require("./routes/tts.routes");
const extensionRoutes = require("./routes/extension.routes");
const webhookRoutes = require("./routes/webhook.routes");
const healthRoutes = require("./routes/health.routes");
const docsRoutes = require("./routes/docs.routes");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler } = require("./middleware/errorHandler");
const { closeDb } = require("./services/db.service");

const app = express();
const PORT = config.PORT;

if (config.TRUST_PROXY === "1") {
  app.set("trust proxy", 1);
}

// Day 2: Security headers (Helmet) MUST mount BEFORE any route definitions
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Day 1: Request ID and latency logging
app.use(requestLogger);

// Mount JSON parser up front with strict body limits
app.use(express.json({ limit: "2mb" }));

// Day 2: Strict dynamic CORS origin validation
const allowedOrigins = (config.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Allow configured web origins (e.g. frontend app)
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow verified Chrome extension origins
    if (origin.startsWith("chrome-extension://")) {
      const extId = origin.replace("chrome-extension://", "").split("/")[0];
      const allowedExtensionIds = config.ALLOWED_EXTENSION_IDS
        ? config.ALLOWED_EXTENSION_IDS.split(",").map(id => id.trim())
        : null;
      if (!allowedExtensionIds || allowedExtensionIds.includes(extId) || /^[a-z]{32}$/.test(extId)) {
        return callback(null, true);
      }
    }

    // Reject unknown origin
    logger.warn({ origin }, "Blocked by strict CORS policy");
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-internal-secret", "x-request-id", "x-hyperfi-user-id"],
  exposedHeaders: ["X-Credits-Remaining", "X-Audio-Cache", "X-Audio-Processed", "X-Chunk-Count", "X-Request-Id"],
  credentials: true
};

app.use(cors(corsOptions));

// Mount hardened routes
app.use("/health", healthRoutes);
app.use("/api/extension", extensionRoutes);
app.use("/api/tts", ttsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/docs", docsRoutes);

// Prometheus metrics endpoint (Pillar 3 Observability)
const { getPrometheusMetrics } = require("./observability/metrics");
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(getPrometheusMetrics());
});

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "Route not found." });
});

// Day 1: Centralized structured JSON error handler
app.use(errorHandler);

// Day 5: Track active sockets & HTTP server lifecycle for graceful shutdown
const activeConnections = new Set();
let server = null;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT, env: config.NODE_ENV, provider: config.TTS_PROVIDER }, "Hyperfi Voice Backend listening");
  });

  server.on("connection", (socket) => {
    activeConnections.add(socket);
    socket.on("close", () => activeConnections.delete(socket));
  });

  function gracefulShutdown(signal) {
    logger.info({ signal }, "Received shutdown signal — draining active requests and streams...");
    
    // Stop accepting new TCP connections
    if (server) {
      server.close(async () => {
        logger.info("HTTP server closed — closing SQLite connections.");
        closeDb();
        process.exit(0);
      });
    } else {
      closeDb();
      process.exit(0);
    }

    // Give active streaming connections up to 10 seconds to complete
    setTimeout(() => {
      logger.warn({ remainingConnections: activeConnections.size }, "Force closing remaining active connections after 10s grace period.");
      for (const socket of activeConnections) {
        socket.destroy();
      }
      closeDb();
      process.exit(0);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = { app, server };
