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

function synthesizeChunk(text) {
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
    const sayArgs = ["-o", aiffPath];
    if (process.env.LOCAL_TTS_VOICE) {
      sayArgs.push("-v", process.env.LOCAL_TTS_VOICE);
    }
    sayArgs.push(text);

    const say = spawn("say", sayArgs);
    let sayErr = "";
    say.stderr.on("data", (d) => (sayErr += d.toString()));

    say.on("error", () =>
      reject(new LocalTtsError("Could not launch the local voice engine.", 500))
    );

    say.on("close", (code) => {
      if (code !== 0) {
        fs.rmSync(aiffPath, { force: true });
        return reject(
          new LocalTtsError(
            `Local voice synthesis failed: ${sayErr.slice(0, 200) || `exit ${code}`}`,
            500
          )
        );
      }

      const ffmpeg = spawn("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        aiffPath,
        "-c:a",
        "libmp3lame",
        "-q:a",
        "4",
        "-f",
        "mp3",
        "pipe:1",
      ]);

      const cleanup = () => fs.rmSync(aiffPath, { force: true });
      ffmpeg.on("close", cleanup);
      ffmpeg.on("error", (err) => {
        cleanup();
        reject(new LocalTtsError(`Transcoding failed: ${err.message}`, 500));
      });

      resolve(ffmpeg.stdout);
    });
  });
}

module.exports = { synthesizeChunk, isLocalProviderEnabled, LocalTtsError };
