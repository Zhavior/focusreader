const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
const { logger } = require("../observability/logger");

const CACHE_DIR = process.env.AUDIO_CACHE_DIR || path.join(__dirname, "../../cache/audio");

let _initPromise = null;
function ensureCacheDir() {
  if (!_initPromise) {
    _initPromise = fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
  }
  return _initPromise;
}

/**
 * Generates a deterministic SHA-256 cache key for any TTS synthesis request.
 */
function getCacheKey({ text, voiceId, speed, background, modelId }) {
  const normalized = JSON.stringify({
    text: (text || "").trim(),
    voiceId: (voiceId || "").toLowerCase(),
    speed: Number(speed || 1.0),
    background: (background || "silence").toLowerCase(),
    modelId: (modelId || "").toLowerCase(),
  });
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Retrieves cached audio Buffer completely non-blocking if available.
 */
async function getCachedAudio(keyOrObj) {
  const key = typeof keyOrObj === "string" ? keyOrObj : getCacheKey(keyOrObj || {});
  if (!key) return null;
  const filePath = path.join(CACHE_DIR, `${key}.mp3`);
  try {
    return await fs.readFile(filePath);
  } catch (e) {
    if (e.code !== "ENOENT") {
      logger.warn({ err: e.message, key }, "AudioCache read error");
    }
    return null;
  }
}

/**
 * Stores synthesized audio Buffer into cache non-blocking (<50ms TTFB on hits).
 */
async function putCachedAudio(keyOrObj, buffer) {
  const key = typeof keyOrObj === "string" ? keyOrObj : (buffer ? getCacheKey(keyOrObj || {}) : null);
  const audioBuf = buffer || (Buffer.isBuffer(keyOrObj?.audioBuffer) ? keyOrObj.audioBuffer : null);
  if (!key || !Buffer.isBuffer(audioBuf)) return;
  
  await ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${key}.mp3`);
  try {
    await fs.writeFile(filePath, audioBuf);
  } catch (e) {
    logger.warn({ err: e.message, key }, "AudioCache write error");
  }
}

module.exports = {
  getCacheKey,
  getCachedAudio,
  putCachedAudio,
};
