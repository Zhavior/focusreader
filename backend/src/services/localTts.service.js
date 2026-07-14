const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Zero-cost local TTS provider using macOS's built-in `say` engine, for
 * development and demos without an ElevenLabs key. Selected when
 * TTS_PROVIDER=local, or automatically when no ELEVENLABS_API_KEY is set.
 *
 * `say` only writes AIFF to a file, so we synthesize to a temp file and
 * transcode to MP3 with ffmpeg, returning ffmpeg's stdout as the audio
 * stream — the same shape the ElevenLabs provider returns, so the route
 * can treat both providers identically.
 */

class LocalTtsError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = "LocalTtsError";
    this.statusCode = statusCode;
  }
}

function isLocalProviderEnabled() {
  return (
    process.env.TTS_PROVIDER === "local" || !process.env.ELEVENLABS_API_KEY
  );
}

function synthesizeChunk(text, voiceName) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "darwin") {
      return reject(
        new LocalTtsError(
          "The local voice provider requires macOS (`say`). Set ELEVENLABS_API_KEY instead.",
          500
        )
      );
    }

    const aiffPath = path.join(os.tmpdir(), `focusreader-${randomUUID()}.aiff`);
    const sayArgs = ["-o", aiffPath, "-r", "210"];
    
    // Map ElevenLabs / frontend display IDs to real macOS built-in voices
    const voiceMap = {
      "Samantha": "Samantha",
      "Reed (English (US))": "Alex",
      "Evan": "Evan",
      "Daniel": "Daniel",
      "Flo (English (US))": "Victoria"
    };
    const cleanVoice = voiceMap[voiceName] || voiceMap[process.env.LOCAL_TTS_VOICE] || voiceName || process.env.LOCAL_TTS_VOICE;
    if (cleanVoice) {
      sayArgs.push("-v", cleanVoice);
    }
    sayArgs.push(text);

    const runSay = (args, fallbackOnFail = true) => {
      const say = spawn("say", args);
      let sayErr = "";
      say.stderr.on("data", (d) => (sayErr += d.toString()));

      say.on("error", () =>
        reject(new LocalTtsError("Could not launch the local voice engine.", 500))
      );

      say.on("close", (code) => {
        if (code !== 0) {
          if (fallbackOnFail && cleanVoice) {
            // Fallback: run `say` with system default voice if selected voice is missing/not installed
            return runSay(["-o", aiffPath, "-r", "210", text], false);
          }
          fs.rmSync(aiffPath, { force: true });
          return reject(
            new LocalTtsError(
              `Local voice synthesis failed: ${sayErr.slice(0, 200) || `exit ${code}`}`,
              500
            )
          );
        }

        const mp3Path = path.join(os.tmpdir(), `focusreader-${randomUUID()}.mp3`);
        const ffmpeg = spawn("ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-threads",
          "4",
          "-i",
          aiffPath,
          "-c:a",
          "libmp3lame",
          "-q:a",
          "9",
          "-f",
          "mp3",
          mp3Path,
        ]);

        const cleanup = () => {
          fs.rmSync(aiffPath, { force: true });
          fs.rmSync(mp3Path, { force: true });
        };

        ffmpeg.on("close", (code) => {
          if (code !== 0) {
            cleanup();
            return reject(new LocalTtsError(`Transcoding failed with exit code ${code}`, 500));
          }
          try {
            const mp3Buf = fs.readFileSync(mp3Path);
            cleanup();
            resolve(mp3Buf);
          } catch (err) {
            cleanup();
            reject(new LocalTtsError(`Failed reading MP3: ${err.message}`, 500));
          }
        });
        ffmpeg.on("error", (err) => {
          cleanup();
          reject(new LocalTtsError(`Transcoding failed: ${err.message}`, 500));
        });
      });
    };

    runSay(sayArgs, true);
  });
}

module.exports = { synthesizeChunk, isLocalProviderEnabled, LocalTtsError };
