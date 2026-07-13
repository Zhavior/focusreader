const axios = require("axios");

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

class ElevenLabsError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.name = "ElevenLabsError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Requests a streamed MP3 for a single text chunk from ElevenLabs.
 * Returns a Node Readable stream of raw audio bytes.
 */
async function streamChunkAudio({ text, voiceId, modelId, apiKey }) {
  const url = `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}/stream`;

  try {
    const response = await axios({
      method: "post",
      url,
      responseType: "stream",
      timeout: 30000,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      data: {
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.35,
          use_speaker_boost: true,
        },
      },
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      const statusCode = error.response.status;

      if (statusCode === 401) {
        throw new ElevenLabsError(
          "ElevenLabs rejected the API key. Verify ELEVENLABS_API_KEY is set correctly.",
          401
        );
      }
      if (statusCode === 429) {
        throw new ElevenLabsError(
          "ElevenLabs rate limit reached. Please wait a moment and try again.",
          429
        );
      }
      if (statusCode === 422) {
        throw new ElevenLabsError(
          "ElevenLabs rejected the request payload (invalid voice, model, or text).",
          422
        );
      }

      throw new ElevenLabsError(
        `ElevenLabs API error (${statusCode}).`,
        statusCode
      );
    }

    if (error.code === "ECONNABORTED") {
      throw new ElevenLabsError(
        "Request to ElevenLabs timed out. Check your network connection and try again.",
        504
      );
    }

    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      throw new ElevenLabsError(
        "Unable to reach ElevenLabs. Check your network connection.",
        502
      );
    }

    throw new ElevenLabsError(
      "Unexpected error while contacting ElevenLabs.",
      500,
      error.message
    );
  }
}

module.exports = { streamChunkAudio, ElevenLabsError };
