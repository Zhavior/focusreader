const { Router } = require("express");
const crypto = require("crypto");
const path = require("path");
const Database = require("better-sqlite3");

const { buildSpeechScript } = require("../services/chunker.service");
const { streamChunkAudio, ElevenLabsError } = require("../services/elevenlabs.service");
const { synthesizeChunk, isLocalProviderEnabled, LocalTtsError } = require("../services/localTts.service");
const { synthesizeOpenSourceChunk, isOpenSourceProviderEnabled, OpenSourceTtsError } = require("../services/openSourceTts.service");
const { asyncHandler } = require("../utils/asyncHandler");

const router = Router();

// ---------------------------------------------------------------------------
// SQLite — open the same DB the Next.js frontend uses.
// Path must match frontend/lib/db.ts  DATA_DIR / focusreader.db
// ---------------------------------------------------------------------------
const DB_PATH =
  process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, "focusreader.db")
    : path.join(__dirname, "../../../frontend/data/focusreader.db");

let _db = null;
function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
  }
  return _db;
}

// ---------------------------------------------------------------------------
// Token resolution — mirrors frontend/lib/db.ts resolveExtensionToken()
// ---------------------------------------------------------------------------
function resolveToken(rawToken) {
  try {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const row = getDb()
      .prepare("SELECT user_id FROM extension_tokens WHERE token_hash = ?")
      .get(hash);
    return row ? row.user_id : null;
  } catch (err) {
    console.error("[ExtRoute] DB lookup failed:", err.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CORS helper — extension content scripts can run on any site
// ---------------------------------------------------------------------------
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

router.options("*", (req, res) => {
  cors(res);
  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// POST /api/extension/tts
// ---------------------------------------------------------------------------
router.post(
  "/tts",
  asyncHandler(async (req, res) => {
    cors(res);

    const authHeader = req.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const userId = resolveToken(authHeader.slice(7).trim());
    if (!userId) {
      return res.status(401).json({
        error: "unauthorized",
        message: "Invalid or revoked extension token. Generate a new one in Dashboard → Tools.",
      });
    }

    const { text } = req.body || {};
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "invalid_input", message: "text is required" });
    }

    const useOpenSource = isOpenSourceProviderEnabled() || (req.body.voiceId && String(req.body.voiceId).startsWith("opensource_"));
    const useLocal = !useOpenSource && isLocalProviderEnabled();
    const voiceId = req.body.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    const modelId = req.body.modelId || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

    if (!useOpenSource && !useLocal && !voiceId) {
      return res.status(400).json({ error: "invalid_input", message: "No voiceId configured." });
    }

    const chunks = buildSpeechScript(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: "invalid_input", message: "No speakable content." });
    }

    const fetchChunk = (chunk) =>
      useOpenSource
        ? synthesizeOpenSourceChunk({ text: chunk, voiceId: req.body.voice || req.body.voiceId })
        : useLocal
          ? synthesizeChunk(chunk, req.body.voice || req.body.voiceId)
          : streamChunkAudio({ text: chunk, voiceId, modelId, apiKey: process.env.ELEVENLABS_API_KEY });

    let firstStream;
    try {
      firstStream = await fetchChunk(chunks[0]);
    } catch (err) {
      const status = err instanceof ElevenLabsError || err instanceof LocalTtsError || err instanceof OpenSourceTtsError ? (err.statusCode || 502) : 502;
      return res.status(status).json({ error: "tts_error", message: err.message });
    }

    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");

    if (chunks.length === 1 && Buffer.isBuffer(firstStream)) {
      res.setHeader("Content-Length", firstStream.length);
      return res.end(firstStream);
    }

    res.setHeader("Transfer-Encoding", "chunked");
    res.flushHeaders();

    const pipe = (stream) =>
      new Promise((resolve, reject) => {
        if (Buffer.isBuffer(stream)) {
          res.write(stream);
          return resolve();
        }
        stream.on("data", (d) => { if (!res.write(d)) { stream.pause(); res.once("drain", () => stream.resume()); } });
        stream.on("end", resolve);
        stream.on("error", reject);
      });

    try {
      await pipe(firstStream);
      for (let i = 1; i < chunks.length; i++) {
        const s = await fetchChunk(chunks[i]);
        await pipe(s);
      }
      res.end();
    } catch (err) {
      console.error("[ExtRoute] TTS stream error:", err.message);
      res.end();
    }
  })
);

// ---------------------------------------------------------------------------
// POST /api/extension/notes
// ---------------------------------------------------------------------------
router.post(
  "/notes",
  asyncHandler(async (req, res) => {
    cors(res);

    const authHeader = req.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const userId = resolveToken(authHeader.slice(7).trim());
    if (!userId) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { note, source } = req.body || {};
    if (!note) return res.status(400).json({ error: "invalid_input" });

    // Notes route only reads token — it doesn't write back via this backend.
    // For now just acknowledge; the Next.js route can handle writes.
    res.json({ ok: true, message: "Note received" });
  })
);

module.exports = router;
