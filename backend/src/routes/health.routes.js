const { Router } = require("express");
const fs = require("fs").promises;
const path = require("path");
const { getDb } = require("../services/db.service");
const audioCache = require("../services/audioCache.service");

const router = Router();

// Liveness probe (Kubernetes/Caddy fast check)
router.get("/live", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    memoryUsage: process.memoryUsage()
  });
});

// Readiness probe (Deep dependency health checks)
router.get("/ready", async (req, res) => {
  const checks = {
    database: false,
    audioCache: false
  };

  try {
    const row = getDb().prepare("SELECT 1 AS val").get();
    checks.database = row?.val === 1;
  } catch (err) {
    checks.database = false;
    checks.databaseError = err.message;
  }

  try {
    // Check write permissions on cache directory
    const cacheDir = path.join(
      process.env.DATA_DIR || path.join(__dirname, "../../../frontend/data"),
      "audio_cache"
    );
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.access(cacheDir, fs.constants.W_OK);
    checks.audioCache = true;
  } catch (err) {
    checks.audioCache = false;
    checks.audioCacheError = err.message;
  }

  const isReady = checks.database && checks.audioCache;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? "ready" : "unready",
    timestamp: new Date().toISOString(),
    checks
  });
});

// Legacy root health endpoint
router.get("/", (req, res) => {
  res.status(200).json({ status: "ok" });
});

module.exports = router;
