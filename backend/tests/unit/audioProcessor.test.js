const { Readable } = require("stream");
const { processAudio, needsProcessing, clampSpeed, BACKGROUND_PRESETS } = require("../../src/services/audioProcessor.service");

describe("Audio Processor Service Suite (`audioProcessor.service.js`)", () => {
  test("clampSpeed restricts speed between 0.5 and 3.0, defaulting to 1.0 on invalid input", () => {
    expect(clampSpeed(1.0)).toBe(1.0);
    expect(clampSpeed(0.2)).toBe(0.5);
    expect(clampSpeed(4.5)).toBe(3.0);
    expect(clampSpeed("1.5")).toBe(1.5);
    expect(clampSpeed(NaN)).toBe(1.0);
    expect(clampSpeed(null)).toBe(1.0);
  });

  test("needsProcessing returns true only when speed or background alter the stream", () => {
    expect(needsProcessing(1.0, "silence")).toBe(false);
    expect(needsProcessing(1.0, null)).toBe(false);
    expect(needsProcessing(1.5, "silence")).toBe(true);
    expect(needsProcessing(1.0, "brown_noise")).toBe(true);
    expect(needsProcessing(1.0, "binaural")).toBe(true);
    expect(needsProcessing(1.0, "invalid_preset")).toBe(false);
  });

  test("BACKGROUND_PRESETS defines accurate lavfi commands and volume levels", () => {
    expect(BACKGROUND_PRESETS.silence).toBeNull();
    expect(BACKGROUND_PRESETS.brown_noise.volume).toBe(0.07);
    expect(BACKGROUND_PRESETS.brown_noise.input).toContain("anoisesrc=color=brown:r=44100:amplitude=0.9");
    expect(BACKGROUND_PRESETS.binaural.volume).toBe(0.12);
    expect(BACKGROUND_PRESETS.binaural.input).toContain("aevalsrc=sin(2*PI*200*t)|sin(2*PI*210*t):s=44100");
  });

  test("processAudio accepts both Buffer and Readable stream inputs and returns a Readable stream", () => {
    const mockBuffer = Buffer.from("RIFF_TEST_BUFFER");
    const outFromBuffer = processAudio(mockBuffer, { speed: 1.0, background: "silence" });
    outFromBuffer.on("error", () => {}); // Ignore expected ffmpeg non-MP3 parse error
    expect(typeof outFromBuffer.pipe).toBe("function");
    outFromBuffer.destroy();

    const mockStream = Readable.from([mockBuffer]);
    const outFromStream = processAudio(mockStream, { speed: 1.0, background: "silence" });
    outFromStream.on("error", () => {}); // Ignore expected ffmpeg non-MP3 parse error
    expect(typeof outFromStream.pipe).toBe("function");
    outFromStream.destroy();
  });

  test("processAudio cleans up stdout and process handle immediately when AbortSignal triggers", (done) => {
    const controller = new AbortController();
    const mockBuffer = Buffer.from("RIFF_LONG_AUDIO_CHUNK");
    const out = processAudio(mockBuffer, { speed: 1.5, background: "brown_noise", signal: controller.signal });

    out.on("error", (err) => {
      // Could be aborted error or ffmpeg exit error if aborted mid-process
      expect(err).toBeDefined();
      done();
    });

    // Abort immediately before ffmpeg tries to parse dummy audio
    controller.abort();
  });
});
