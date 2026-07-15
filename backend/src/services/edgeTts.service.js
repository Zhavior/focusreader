/**
 * edgeTts.service.js
 *
 * Free Microsoft Edge TTS — neural-quality voices, no API key required.
 * Uses the same engine as Microsoft Edge browser's Read Aloud feature.
 *
 * Voice quality: ⭐⭐⭐⭐ (close to ElevenLabs standard tier)
 * Cost: $0.00 forever
 *
 * Voice map — matches our VOICES array in the frontend reader:
 *   Male   Warm/Deep    → en-US-GuyNeural
 *   Male   US Standard  → en-US-ChristopherNeural
 *   Female US Standard  → en-US-JennyNeural
 *   Male   UK British   → en-GB-RyanNeural
 *   Female Warm/Calm    → en-US-AriaNeural
 */

const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");

// Patch MsEdgeTTS prototype to prevent uncaught TypeErrors when late audio/metadata chunks arrive after stream close/timeout
if (MsEdgeTTS && MsEdgeTTS.prototype) {
  const originalPushAudio = MsEdgeTTS.prototype._pushAudioData;
  MsEdgeTTS.prototype._pushAudioData = function(data, requestId) {
    if (this._streams && this._streams[requestId] && this._streams[requestId].audio) {
      try {
        originalPushAudio.call(this, data, requestId);
      } catch (err) {
        console.warn(`[EdgeTTS] Suppressed late audio chunk error on stream ${requestId}:`, err.message);
      }
    }
  };

  const originalPushMeta = MsEdgeTTS.prototype._pushMetadata;
  MsEdgeTTS.prototype._pushMetadata = function(data, requestId) {
    if (this._streams && this._streams[requestId] && this._streams[requestId].metadata) {
      try {
        originalPushMeta.call(this, data, requestId);
      } catch (err) {
        console.warn(`[EdgeTTS] Suppressed late metadata chunk error on stream ${requestId}:`, err.message);
      }
    }
  };
}

// Maps our frontend voice IDs to Microsoft Edge neural voice names
const EDGE_VOICE_MAP = {
  "Evan":                   "en-US-GuyNeural",
  "Reed (English (US))":    "en-US-ChristopherNeural",
  "Samantha":               "en-US-JennyNeural",
  "Daniel":                 "en-GB-RyanNeural",
  "Flo (English (US))":     "en-US-AriaNeural",
  // ElevenLabs voice IDs — map to nearest equivalent
  "nPczCjzI2XWHr1WexmYd":  "en-US-GuyNeural",
  "ErXwobaYiN019PkySvjV":  "en-US-ChristopherNeural",
  "EXAVITQu4vr4xnSDxMaL":  "en-US-JennyNeural",
  "ONwK4e9ZLuTAKqWW03F9":  "en-GB-RyanNeural",
  "21m00Tcm4TlvDq8ikWAM":  "en-US-AriaNeural",
};

const DEFAULT_VOICE = "en-US-GuyNeural";

class EdgeTtsError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "EdgeTtsError";
    this.statusCode = statusCode;
  }
}

// ─── Connection Cache & Lifecycle Manager ──────────────────────────────────────
let cachedTts = null;
let cachedVoice = null;
let lastUsedTime = 0;
const CONNECTION_TTL = 30000; // Keep connection warm for 30s of inactivity

async function getTtsInstance(edgeVoice) {
  const now = Date.now();
  
  // Reuse existing client if voice matches and connection is warm
  if (cachedTts && cachedVoice === edgeVoice && (now - lastUsedTime < CONNECTION_TTL)) {
    lastUsedTime = now;
    return cachedTts;
  }

  // Clear stale/differing cache
  cachedTts = null;

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    cachedTts = tts;
    cachedVoice = edgeVoice;
    lastUsedTime = now;
    return tts;
  } catch (err) {
    throw new EdgeTtsError(`Edge TTS failed to connect to Microsoft voice server: ${err.message}`);
  }
}

// ─── Sentence-Based Sub-Chunker ───────────────────────────────────────────────
function splitIntoSentences(text, maxChars = 800) {
  // Split on punctuation (.!?) followed by space/end of string
  const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text];
  const chunks = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Fallback split for single sentences that exceed maxChars
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length > maxChars) {
      for (let i = 0; i < chunk.length; i += maxChars) {
        finalChunks.push(chunk.slice(i, i + maxChars));
      }
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks.filter(c => c.trim().length > 0);
}

/**
 * Synthesize text using Microsoft Edge TTS.
 * Returns a Buffer of MP3 audio bytes.
 *
 * @param {string} text         - The text to speak
 * @param {string} [voiceId]    - Frontend voice ID or Edge voice name
 * @returns {Promise<Buffer>}
 */
async function synthesizeEdgeTts({ text, voiceId }) {
  const edgeVoice = EDGE_VOICE_MAP[voiceId] || voiceId || DEFAULT_VOICE;
  console.log(`[EdgeTTS] Synthesizing sub-chunk: voiceId="${voiceId}", edgeVoice="${edgeVoice}", text="${text.slice(0, 40)}..."`);

  // Split text into Edge-friendly chunks to prevent MS WebSocket timeouts
  const subChunks = splitIntoSentences(text, 450);
  const audioBuffers = [];
  const { synthesizeChunk } = require("./localTts.service");

  for (const subChunk of subChunks) {
    let attempt = 0;
    const maxAttempts = 4;
    let subChunkAudio = null;

    while (attempt < maxAttempts) {
      attempt++;
      try {
        // Always recycle socket on retry attempts > 1
        if (attempt > 1) cachedTts = null;
        const tts = await getTtsInstance(edgeVoice);
        
        // Race synthesis stream against a strict hard timeout
        subChunkAudio = await Promise.race([
          new Promise((resolve, reject) => {
            const chunks = [];
            let result;

            try {
              result = tts.toStream(subChunk);
            } catch (err) {
              return reject(new EdgeTtsError(`Edge TTS toStream error: ${err.message}`));
            }

            const audioStream = result.audioStream;
            if (!audioStream || typeof audioStream.on !== "function") {
              return reject(new EdgeTtsError("Edge TTS returned no audio stream"));
            }

            audioStream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            audioStream.on("end", () => resolve(Buffer.concat(chunks)));
            audioStream.on("error", (err) => {
              const currentBuf = Buffer.concat(chunks);
              // If we already received substantial audio (> 1KB), accept it instead of crashing on missing turn.end socket close
              if (currentBuf.length >= 1000) {
                console.warn(`[EdgeTTS] Stream closed without turn.end after receiving ${currentBuf.length} bytes — accepting valid audio.`);
                return resolve(currentBuf);
              }
              reject(new EdgeTtsError(`Edge TTS audio stream error: ${err.message}`));
            });
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Edge TTS request timed out (8s)")), 8000)
          )
        ]);

        lastUsedTime = Date.now();
        break; // Success for this sub-chunk, exit attempt loop
      } catch (err) {
        console.warn(`[EdgeTTS] Sub-chunk attempt ${attempt} failed: ${err.message}`);
        cachedTts = null; // Force fresh WebSocket connection on next attempt

        if (attempt >= maxAttempts) {
          console.warn(`[EdgeTTS] Microsoft Edge WebSockets unavailable after ${maxAttempts} attempts — falling back to server-side local TTS for sub-chunk.`);
          try {
            if (process.platform === "darwin") {
              const stream = await synthesizeChunk(subChunk, voiceId);
              const fallbackBufs = [];
              await new Promise((resolve, reject) => {
                stream.on("data", (d) => fallbackBufs.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
                stream.on("end", resolve);
                stream.on("error", reject);
              });
              subChunkAudio = Buffer.concat(fallbackBufs);
              if (subChunkAudio && subChunkAudio.length > 0) break;
            }
          } catch (fallbackErr) {
            console.error("[EdgeTTS] Server-side fallback also failed:", fallbackErr.message);
          }
          throw new EdgeTtsError(`Edge TTS failed after ${maxAttempts} attempts: ${err.message}`);
        }
        
        // Progressive backoff: 300ms, 600ms, 900ms
        await new Promise(r => setTimeout(r, attempt * 300));
      }
    }

    if (subChunkAudio) {
      audioBuffers.push(subChunkAudio);
    }
  }

  return Buffer.concat(audioBuffers);
}

function isEdgeTtsEnabled() {
  return process.env.TTS_PROVIDER === "edge";
}

module.exports = { synthesizeEdgeTts, isEdgeTtsEnabled, EdgeTtsError, EDGE_VOICE_MAP };
