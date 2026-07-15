const { spawn } = require("child_process");

/**
 * Background "focus" beds. These are generated procedurally by ffmpeg's lavfi
 * sources, so there are no audio assets to ship.
 *
 *  - brown_noise: brown (Brownian) noise — the classic ADHD focus bed.
 *  - binaural:    a stereo pair of slightly-detuned sine tones (200Hz left /
 *                 210Hz right = a 10Hz "beat"), mixed very low under speech.
 *
 * `volume` is the level the bed is mixed at, relative to the speech.
 */
const BACKGROUND_PRESETS = {
  silence: null,
  brown_noise: {
    input: ["-f", "lavfi", "-i", "anoisesrc=color=brown:r=44100:amplitude=0.9"],
    volume: 0.07,
  },
  binaural: {
    input: [
      "-f",
      "lavfi",
      "-i",
      "aevalsrc=sin(2*PI*200*t)|sin(2*PI*210*t):s=44100",
    ],
    volume: 0.12,
  },
};

function clampSpeed(speed) {
  if (speed === null || speed === undefined || speed === "") return 1.0;
  const n = Number(speed);
  if (!Number.isFinite(n) || n <= 0) return 1.0;
  return Math.min(3.0, Math.max(0.5, n));
}

/** True if the requested settings would change the audio at all. */
function needsProcessing(speed, background) {
  return (
    clampSpeed(speed) !== 1.0 ||
    (typeof background === "string" &&
      background !== "silence" &&
      background in BACKGROUND_PRESETS)
  );
}

/**
 * Runs the assembled speech (a single MP3 Buffer or Readable stream) through ffmpeg
 * to apply the playback speed and mix in the background bed. Returns a Readable stream
 * of the processed MP3 for piping straight to the HTTP response.
 *
 * `amix ... normalize=0` keeps the speech at full loudness while adding the bed
 * at its own low volume; `duration=first` ties the output length to the speech
 * so the infinite lavfi bed is trimmed automatically.
 *
 * Supports AbortSignal (`signal`) to kill ffmpeg child processes immediately
 * when a client disconnects, preventing memory leaks and zombie processes.
 */
function processAudio(speechInput, { speed = 1.0, background = "silence", signal } = {}) {
  const s = clampSpeed(speed);
  const preset = BACKGROUND_PRESETS[background] || null;

  const args = ["-hide_banner", "-loglevel", "error", "-i", "pipe:0"];
  let filter;

  if (preset) {
    args.push(...preset.input);
    filter =
      `[0:a]atempo=${s}[sp];` +
      `[1:a]volume=${preset.volume}[bed];` +
      `[sp][bed]amix=inputs=2:duration=first:normalize=0[out]`;
  } else {
    filter = `[0:a]atempo=${s}[out]`;
  }

  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-c:a",
    "libmp3lame",
    "-q:a",
    "4",
    "-f",
    "mp3",
    "pipe:1"
  );

  const ff = spawn("ffmpeg", args);

  let stderr = "";
  ff.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  const cleanup = () => {
    try {
      if (!ff.killed) ff.kill("SIGKILL");
    } catch (e) {}
  };

  const onAbort = () => {
    cleanup();
    if (!ff.stdout.destroyed) {
      ff.stdout.destroy(new Error("Audio processing aborted by client connection close."));
    }
  };

  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort);
      ff.on("close", () => {
        signal.removeEventListener("abort", onAbort);
      });
    }
  }

  ff.on("error", (err) => {
    cleanup();
    if (!ff.stdout.destroyed) {
      const procErr = new Error(`ffmpeg process failure: ${err.message}`);
      ff.stdout.emit("error", procErr);
    }
  });

  ff.on("close", (code) => {
    if (code !== 0 && code !== null) {
      if (signal?.aborted || ff.stdout.destroyed) return;
      console.error(`ffmpeg exited ${code}: ${stderr.slice(0, 500)}`);
      const procErr = new Error(`ffmpeg exited with code ${code}: ${stderr.slice(0, 500)}`);
      ff.stdout.emit("error", procErr);
    }
  });

  // Ignore EPIPE if ffmpeg dies before we finish writing the input.
  ff.stdin.on("error", () => {});

  if (speechInput && typeof speechInput.pipe === "function") {
    speechInput.on("error", (err) => {
      cleanup();
      ff.stdout.emit("error", err);
    });
    speechInput.pipe(ff.stdin);
  } else if (Buffer.isBuffer(speechInput) || typeof speechInput === "string") {
    ff.stdin.end(speechInput);
  } else if (speechInput) {
    ff.stdin.end(Buffer.from(speechInput));
  } else {
    ff.stdin.end();
  }

  return ff.stdout;
}

module.exports = { processAudio, needsProcessing, clampSpeed, BACKGROUND_PRESETS };
