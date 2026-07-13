export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export class VoiceGenerationError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "VoiceGenerationError";
  }
}

export interface GenerateVoiceParams {
  text: string;
  voiceId?: string;
  modelId?: string;
  filename?: string;
  onProgress?: (receivedBytes: number) => void;
  signal?: AbortSignal;
}

/**
 * Calls the streaming TTS endpoint and reads the response body incrementally,
 * reporting progress as bytes arrive. Returns the fully assembled audio Blob
 * once the stream completes, ready for both playback and download.
 */
export async function generateVoice({
  text,
  voiceId,
  modelId,
  filename,
  onProgress,
  signal,
}: GenerateVoiceParams): Promise<Blob> {
  let response: Response;

  try {
    // Route through the same-origin credit-gate interceptor (app/api/tts),
    // which authenticates via Clerk and proxies to the streaming backend.
    response = await fetch(`/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId, modelId, filename }),
      signal,
    });
  } catch {
    throw new VoiceGenerationError(
      "Could not reach the voice server. Check your connection and that the backend is running."
    );
  }

  if (!response.ok) {
    let message = "Failed to generate voice audio.";
    try {
      const errorBody = await response.json();
      message = errorBody.message || message;
    } catch {
      // response wasn't JSON; fall back to default message
    }
    throw new VoiceGenerationError(message, response.status);
  }

  if (!response.body) {
    throw new VoiceGenerationError("Empty response from voice server.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      receivedBytes += value.byteLength;
      onProgress?.(receivedBytes);
    }
  }

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}
