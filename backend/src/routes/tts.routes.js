const { Router } = require("express");
const { buildSpeechScript } = require("../services/chunker.service");
const { streamChunkAudio, ElevenLabsError } = require("../services/elevenlabs.service");
const { synthesizeChunk, isLocalProviderEnabled, LocalTtsError } = require("../services/localTts.service");
const { processAudio, needsProcessing } = require("../services/audioProcessor.service");
const { validateApiKey } = require("../middleware/validateApiKey");
const { internalAuth } = require("../middleware/internalAuth");
const { ttsRateLimiter } = require("../middleware/rateLimiter");
const { asyncHandler } = require("../utils/asyncHandler");

const router = Router();

const MAX_TEXT_LENGTH = 200000;

router.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/**
 * POST /api/tts/stream
 * Body: { text: string, voiceId?: string, modelId?: string, filename?: string }
 *
 * Splits text into ElevenLabs-safe chunks, requests a streamed MP3 for each
 * chunk sequentially, and pipes the raw audio bytes straight through to the
 * client as they arrive (chunked transfer encoding). Because every chunk is
 * the same voice/model/format, concatenating the byte streams back-to-back
 * produces continuous, gap-free playback and a single valid MP3 file — the
 * client never has to know chunk boundaries existed.
 */
// The ElevenLabs key requirement only applies when ElevenLabs is the active
// provider; the free local provider (macOS `say`) needs no key.
function requireProviderConfig(req, res, next) {
  if (isLocalProviderEnabled()) return next();
  return validateApiKey(req, res, next);
}

router.post(
  "/stream",
  internalAuth,
  ttsRateLimiter,
  requireProviderConfig,
  asyncHandler(async (req, res) => {
    const { text, voiceId, modelId, filename, speed, background, checkpoints } =
      req.body || {};

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: "invalid_input",
        message: "Request body must include non-empty 'text'.",
      });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: "invalid_input",
        message: `Text exceeds the maximum allowed length of ${MAX_TEXT_LENGTH} characters.`,
      });
    }

    const useLocalProvider = isLocalProviderEnabled();
    const resolvedVoiceId = voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    const resolvedModelId = modelId || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

    if (!useLocalProvider && !resolvedVoiceId) {
      return res.status(400).json({
        error: "invalid_input",
        message: "No voiceId provided and no ELEVENLABS_DEFAULT_VOICE_ID configured.",
      });
    }

    const chunks = buildSpeechScript(text, { checkpoints: checkpoints === true });

    if (chunks.length === 0) {
      return res.status(400).json({
        error: "invalid_input",
        message: "Text produced no speakable content after processing.",
      });
    }

    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });

    const safeName = `${(filename || "voice-output").replace(
      /[^a-zA-Z0-9-_]/g,
      "_"
    )}.mp3`;
    const fetchChunk = (chunk) =>
      useLocalProvider
        ? synthesizeChunk(chunk)
        : streamChunkAudio({
            text: chunk,
            voiceId: resolvedVoiceId,
            modelId: resolvedModelId,
            apiKey: process.env.ELEVENLABS_API_KEY,
          });

    // Fetch the first chunk BEFORE committing to a 200 response. This lets
    // auth/network/rate-limit failures surface as a clean JSON error instead
    // of a truncated audio stream, since headers can't be un-sent once flushed.
    let firstAudioStream;
    try {
      firstAudioStream = await fetchChunk(chunks[0]);
    } catch (error) {
      if (error instanceof ElevenLabsError || error instanceof LocalTtsError) {
        return res.status(error.statusCode || 502).json({
          error: "elevenlabs_error",
          message: error.message,
        });
      }
      throw error;
    }

    // ---- Processed path: speed change and/or background bed --------------
    // ffmpeg needs the complete speech before it can post-process, so we
    // buffer every chunk first (which also keeps error surfacing clean) and
    // then stream ffmpeg's output.
    if (needsProcessing(speed, background)) {
      let speech;
      try {
        const buffers = [await collectStream(firstAudioStream)];
        for (let i = 1; i < chunks.length; i += 1) {
          if (clientDisconnected) return;
          const stream = await fetchChunk(chunks[i]);
          buffers.push(await collectStream(stream));
        }
        speech = Buffer.concat(buffers);
      } catch (error) {
        if (error instanceof ElevenLabsError || error instanceof LocalTtsError) {
          return res.status(error.statusCode || 502).json({
            error: "elevenlabs_error",
            message: error.message,
          });
        }
        throw error;
      }

      res.status(200);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.setHeader("X-Audio-Processed", "true");
      res.flushHeaders();

      const processed = processAudio(speech, { speed, background });
      processed.on("error", (err) => {
        console.error("Audio processing stream error:", err.message);
        if (!res.writableEnded) res.end();
      });
      processed.pipe(res);
      return;
    }

    // ---- Direct path: stream raw speech chunks as they arrive ------------
    res.status(200);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Chunk-Count", String(chunks.length));
    res.flushHeaders();

    try {
      await pipeChunkToResponse(firstAudioStream, res);

      for (let i = 1; i < chunks.length; i += 1) {
        if (clientDisconnected) break;
        const audioStream = await fetchChunk(chunks[i]);
        await pipeChunkToResponse(audioStream, res);
      }

      res.end();
    } catch (error) {
      // Headers are already committed at this point, so the best we can do
      // is log the failure and terminate the connection cleanly.
      console.error("Streaming failed mid-response:", error.message);
      res.end();
    }
  })
);

function collectStream(stream) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    stream.on("data", (d) => buffers.push(d));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
  });
}

function pipeChunkToResponse(audioStream, res) {
  return new Promise((resolve, reject) => {
    audioStream.on("data", (data) => {
      const canContinue = res.write(data);
      if (!canContinue) {
        audioStream.pause();
        res.once("drain", () => audioStream.resume());
      }
    });
    audioStream.on("end", resolve);
    audioStream.on("error", reject);
  });
}

module.exports = router;
