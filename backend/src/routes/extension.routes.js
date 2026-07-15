const { Router } = require("express");
const crypto = require("crypto");
const { extensionAuth } = require("../middleware/extensionAuth");
const { ttsRateLimiter } = require("../middleware/rateLimiter");
const { synthesizeOrchestrated } = require("../services/ttsOrchestrator.service");
const { getBalance, spendCreditsAtomic } = require("../services/db.service");
const { asyncHandler } = require("../utils/asyncHandler");
const { InvalidInputError } = require("../utils/errors");

const router = Router();
const MAX_TEXT_LENGTH = 200000;

// All extension routes require authentication via Bearer token
router.use(extensionAuth);

// ---------------------------------------------------------------------------
// GET /api/extension/token
// ---------------------------------------------------------------------------
router.get(
  "/token",
  asyncHandler(async (req, res) => {
    const dbService = require("../services/db.service");
    const balance = await getBalance(req.userId);
    res.status(200).json({
      status: "authenticated",
      user: {
        id: req.userId,
        tier: "pro",
        credits_remaining: balance
      }
    });
  })
);

// ---------------------------------------------------------------------------
// POST /api/extension/tts
// ---------------------------------------------------------------------------
router.post(
  "/tts",
  ttsRateLimiter,
  asyncHandler(async (req, res) => {
    const { text, voiceId, voice, modelId } = req.body || {};
    if (!text || !text.trim()) {
      throw new InvalidInputError("text is required");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new InvalidInputError(`Text exceeds ${MAX_TEXT_LENGTH} characters.`);
    }

    const cost = text.length;
    // Fast check before synthesis
    const currentBalance = await getBalance(req.userId);
    if (currentBalance < cost) {
      const { InsufficientCreditsError } = require("../utils/errors");
      throw new InsufficientCreditsError("Out of credits — open Billing to upgrade.");
    }

    // Attach AbortController for stream cancellation (Day 5)
    const abortController = new AbortController();
    req.on("close", () => {
      if (!res.headersSent || !res.writableFinished) {
        abortController.abort();
      }
    });

    // Synthesize using multi-provider orchestrator with cache support
    const finalAudioBuffer = await synthesizeOrchestrated({
      text,
      voiceId,
      voice,
      modelId,
      speed: 1.0,
      signal: abortController.signal
    });

    // Deduct credits atomically after synthesis succeeds (Day 3)
    const remaining = await spendCreditsAtomic(req.userId, cost, `ext:${crypto.randomUUID()}`);
    res.setHeader("X-Credits-Remaining", String(remaining));
    res.setHeader("X-Credits-Deducted", String(cost));

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", finalAudioBuffer.length);
    return res.end(finalAudioBuffer);
  })
);

// ---------------------------------------------------------------------------
// POST /api/extension/notes
// ---------------------------------------------------------------------------
router.post(
  "/notes",
  asyncHandler(async (req, res) => {
    const { note } = req.body || {};
    if (!note) {
      throw new InvalidInputError("note is required");
    }
    res.json({ ok: true, message: "Note received" });
  })
);

module.exports = router;
