const { buildSpeechScript } = require("./chunker.service");
const { streamChunkAudio, ElevenLabsError } = require("./elevenlabs.service");
const { synthesizeChunk, isLocalProviderEnabled, LocalTtsError } = require("./localTts.service");
const { synthesizeOpenSourceChunk, isOpenSourceProviderEnabled, OpenSourceTtsError } = require("./openSourceTts.service");
const { synthesizeEdgeTts, isEdgeTtsEnabled, EdgeTtsError, EDGE_VOICE_MAP } = require("./edgeTts.service");
const audioCache = require("./audioCache.service");
const { logger } = require("../observability/logger");
const { recordTtsSynthesis, recordTtsFailover, recordCacheHit, recordCacheMiss } = require("../observability/metrics");
const { captureException } = require("../observability/sentry");
const { ProviderTtsError, InvalidInputError } = require("../utils/errors");

const collectStreamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    if (Buffer.isBuffer(stream)) return resolve(stream);
    const buffers = [];
    stream.on("data", (d) => buffers.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
    stream.on("end", () => resolve(Buffer.concat(buffers)));
    stream.on("error", reject);
  });

/**
 * Resolves the active TTS provider and voice/model IDs based on env and request payload.
 */
function resolveProvider({ voiceId, modelId, voice }) {
  const providerEnv = process.env.TTS_PROVIDER || "edge";
  const resolvedVoiceId = voiceId || voice || process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  const resolvedModelId = modelId || process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  const useEdge = providerEnv === "edge" || Boolean(EDGE_VOICE_MAP[resolvedVoiceId]);
  const useOpenSource = !useEdge && (isOpenSourceProviderEnabled() || (resolvedVoiceId && String(resolvedVoiceId).startsWith("opensource_")));
  const useLocal = !useEdge && !useOpenSource && isLocalProviderEnabled();
  const useElevenLabs = !useEdge && !useOpenSource && !useLocal;

  let providerName = "elevenlabs";
  if (useEdge) providerName = "edge";
  else if (useOpenSource) providerName = "opensource";
  else if (useLocal) providerName = "local";

  if (useElevenLabs && !resolvedVoiceId) {
    throw new InvalidInputError("No voiceId provided and no ELEVENLABS_DEFAULT_VOICE_ID configured.");
  }

  return { providerName, voiceId: resolvedVoiceId, modelId: resolvedModelId };
}

/**
 * Synthesizes text chunks sequentially or via stream, handling caching, cancellation, and multi-tier fallbacks.
 */
async function synthesizeOrchestrated({ text, voiceId, modelId, voice, speed = 1.0, signal, onChunk }) {
  const chunks = buildSpeechScript(text);
  if (!chunks || chunks.length === 0) {
    throw new InvalidInputError("Text produced no speakable chunks.");
  }

  const { providerName, voiceId: resolvedVoiceId, modelId: resolvedModelId } = resolveProvider({ voiceId, modelId, voice });

  const fetchChunkWithFallback = async (chunk) => {
    if (signal?.aborted) {
      const abortErr = new Error("Synthesis aborted by client connection close.");
      abortErr.name = "AbortError";
      throw abortErr;
    }

    if (providerName === "edge") {
      return synthesizeEdgeTts({ text: chunk, voiceId: resolvedVoiceId });
    }
    if (providerName === "opensource") {
      return synthesizeOpenSourceChunk({ text: chunk, voiceId: resolvedVoiceId });
    }
    if (providerName === "local") {
      return synthesizeChunk(chunk, resolvedVoiceId);
    }
    return streamChunkAudio({ text: chunk, voiceId: resolvedVoiceId, modelId: resolvedModelId, apiKey: process.env.ELEVENLABS_API_KEY, signal });
  };

  const audioBuffers = [];

  for (const chunk of chunks) {
    if (signal?.aborted) break;

    let chunkBuf = await audioCache.getCachedAudio({ text: chunk, voiceId: resolvedVoiceId, speed });
    if (chunkBuf) {
      recordCacheHit("audio");
    } else {
      recordCacheMiss("audio");
      const chunkStart = Date.now();
      try {
        const stream = await fetchChunkWithFallback(chunk);
        chunkBuf = await collectStreamToBuffer(stream);
        const dur = Date.now() - chunkStart;
        recordTtsSynthesis(providerName, resolvedVoiceId, "success", dur);
        if (chunkBuf && chunkBuf.length > 0) {
          audioCache.putCachedAudio({ text: chunk, voiceId: resolvedVoiceId, speed, audioBuffer: chunkBuf }).catch(() => {});
        }
      } catch (err) {
        if (err.name === "AbortError" || signal?.aborted) {
          throw err;
        }
        const dur = Date.now() - chunkStart;
        recordTtsSynthesis(providerName, resolvedVoiceId, "error", dur);
        logger.warn({ err: err.message, provider: providerName }, "Primary TTS provider failed on chunk, attempting emergency local fallback.");
        captureException(err, { provider: providerName, extra: { reason: "provider_failover", fallback: "local" } });
        if (process.platform === "darwin" && providerName !== "local") {
          recordTtsFailover(providerName, "local", err.message);
          const fallbackStart = Date.now();
          try {
            const fallbackStream = await synthesizeChunk(chunk, resolvedVoiceId);
            chunkBuf = await collectStreamToBuffer(fallbackStream);
            recordTtsSynthesis("local", resolvedVoiceId, "success", Date.now() - fallbackStart);
          } catch (fallbackErr) {
            recordTtsSynthesis("local", resolvedVoiceId, "error", Date.now() - fallbackStart);
            throw new ProviderTtsError(providerName, `Primary (${err.message}) and fallback (${fallbackErr.message}) failed.`);
          }
        } else {
          const status = err.statusCode || 502;
          throw new ProviderTtsError(providerName, err.message, status);
        }
      }
    }

    if (chunkBuf) {
      if (onChunk) {
        onChunk(chunkBuf);
      }
      audioBuffers.push(chunkBuf);
    }
  }

  return Buffer.concat(audioBuffers);
}

module.exports = {
  synthesizeOrchestrated,
  resolveProvider,
  collectStreamToBuffer,
};
