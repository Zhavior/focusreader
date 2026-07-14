const fetchFn = global.fetch || require("node-fetch");

class OpenSourceTtsError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.name = "OpenSourceTtsError";
    this.statusCode = statusCode;
  }
}

/**
 * Synthesizes audio using open-source neural speech providers (Piper, Kokoro-82M, LocalAI, or OpenAI-compatible endpoints).
 * Future-proofs the Zhavior application for self-hosted / commercial product deployment without vendor lock-in.
 */
async function synthesizeOpenSourceChunk({ text, voiceId = "en_US-lessac-medium", baseUrl = process.env.OPEN_SOURCE_TTS_URL }) {
  if (!baseUrl) {
    throw new OpenSourceTtsError("OPEN_SOURCE_TTS_URL is not configured on the server.", 500);
  }

  try {
    // Check if endpoint is OpenAI TTS compatible (/v1/audio/speech)
    const isOpenAiFormat = baseUrl.includes("/v1/audio/speech") || baseUrl.includes("/speech");
    
    const response = await fetchFn(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.OPEN_SOURCE_TTS_KEY ? { "Authorization": `Bearer ${process.env.OPEN_SOURCE_TTS_KEY}` } : {})
      },
      body: JSON.stringify(
        isOpenAiFormat
          ? {
              model: "kokoro-82m", // or tts-1 / local model
              input: text,
              voice: voiceId,
              response_format: "mp3"
            }
          : {
              text: text,
              voice: voiceId
            }
      )
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new OpenSourceTtsError(`Open-source TTS provider returned ${response.status}: ${errText.slice(0, 200)}`, response.status);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    if (err instanceof OpenSourceTtsError) throw err;
    throw new OpenSourceTtsError(`Open-source TTS synthesis error: ${err.message}`, 502);
  }
}

function isOpenSourceProviderEnabled() {
  return Boolean(process.env.OPEN_SOURCE_TTS_URL);
}

module.exports = { synthesizeOpenSourceChunk, isOpenSourceProviderEnabled, OpenSourceTtsError };
