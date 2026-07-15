const { Router } = require("express");
const { synthesizeOrchestrated, resolveProvider } = require("../services/ttsOrchestrator.service");
const { processAudio, needsProcessing } = require("../services/audioProcessor.service");
const { getCacheKey, getCachedAudio, putCachedAudio } = require("../services/audioCache.service");
const { validateApiKey } = require("../middleware/validateApiKey");
const { internalAuth } = require("../middleware/internalAuth");
const { ttsRateLimiter } = require("../middleware/rateLimiter");
const { enforceCredits } = require("../middleware/creditChecker");
const { asyncHandler } = require("../utils/asyncHandler");
const { InvalidInputError } = require("../utils/errors");
const { recordCacheHit, recordCacheMiss } = require("../observability/metrics");

const router = Router();
const MAX_TEXT_LENGTH = 200000;

function requireProviderConfig(req, res, next) {
  const { providerName } = resolveProvider({
    voiceId: req.body?.voiceId,
    modelId: req.body?.modelId,
    voice: req.body?.voice
  });
  if (providerName !== "elevenlabs") return next();
  return validateApiKey(req, res, next);
}

router.post(
  "/stream",
  internalAuth,
  ttsRateLimiter,
  requireProviderConfig,
  enforceCredits,
  asyncHandler(async (req, res) => {
    const { text, voiceId, modelId, filename, speed = 1.0, background, voice } = req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      throw new InvalidInputError("Request body must include non-empty 'text'.");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new InvalidInputError(`Text exceeds the maximum allowed length of ${MAX_TEXT_LENGTH} characters.`);
    }

    const safeName = `${(filename || "voice-output").replace(/[^a-zA-Z0-9-_]/g, "_")}.mp3`;
    const { providerName, voiceId: resolvedVoiceId, modelId: resolvedModelId } = resolveProvider({ voiceId, modelId, voice });

    // Attach AbortController for stream cancellation (Day 5)
    const abortController = new AbortController();
    req.on("close", () => {
      if (!res.headersSent || !res.writableFinished) {
        abortController.abort();
      }
    });

    const cacheKey = getCacheKey({ text, voiceId: resolvedVoiceId, speed, background, modelId: resolvedModelId });
    const cachedBuffer = await getCachedAudio(cacheKey);
    if (cachedBuffer) {
      recordCacheHit("audio");
      res.status(200);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.setHeader("X-Audio-Cache", "HIT");
      return res.end(cachedBuffer);
    }
    recordCacheMiss("audio");

    // If audio post-processing (speed change / background bed) is needed:
    if (needsProcessing(speed, background)) {
      const speechBuffer = await synthesizeOrchestrated({
        text,
        voiceId: resolvedVoiceId,
        modelId: resolvedModelId,
        voice,
        speed: 1.0,
        signal: abortController.signal
      });

      res.status(200);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.setHeader("X-Audio-Processed", "true");
      res.setHeader("X-Audio-Cache", "MISS");
      res.flushHeaders();

      const processed = processAudio(speechBuffer, { speed, background, signal: abortController.signal });
      const processedBuffers = [];
      let totalBufferedBytes = 0;
      const MAX_CACHE_BUFFER_BYTES = 15 * 1024 * 1024; // 15MB safety ceiling per stream

      processed.on("data", (d) => {
        const buf = Buffer.isBuffer(d) ? d : Buffer.from(d);
        if (totalBufferedBytes + buf.length <= MAX_CACHE_BUFFER_BYTES) {
          processedBuffers.push(buf);
          totalBufferedBytes += buf.length;
        } else if (processedBuffers.length > 0) {
          // Release RAM if buffer threshold is exceeded during massive streams
          processedBuffers.length = 0;
          totalBufferedBytes = Infinity;
        }
      });
      processed.on("end", () => {
        if (totalBufferedBytes < Infinity && processedBuffers.length > 0) {
          putCachedAudio(cacheKey, Buffer.concat(processedBuffers)).catch(() => {});
        }
      });
      processed.on("error", (err) => {
        if (!res.writableEnded) res.end();
      });
      return processed.pipe(res);
    }

    // Direct path: synthesize via orchestrator, cache, and stream
    const rawAudioBuffer = await synthesizeOrchestrated({
      text,
      voiceId: resolvedVoiceId,
      modelId: resolvedModelId,
      voice,
      speed,
      signal: abortController.signal
    });

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Content-Length", rawAudioBuffer.length);
    res.setHeader("X-Audio-Cache", "MISS");
    
    putCachedAudio(cacheKey, rawAudioBuffer).catch(() => {});
    return res.end(rawAudioBuffer);
  })
);

module.exports = router;
