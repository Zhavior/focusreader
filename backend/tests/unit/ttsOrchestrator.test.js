const { resolveProvider, synthesizeOrchestrated } = require("../../src/services/ttsOrchestrator.service");
const edgeService = require("../../src/services/edgeTts.service");
const localService = require("../../src/services/localTts.service");
const audioCache = require("../../src/services/audioCache.service");

jest.mock("../../src/services/edgeTts.service");
jest.mock("../../src/services/localTts.service");
jest.mock("../../src/services/audioCache.service");

describe("TTS Orchestrator Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TTS_PROVIDER = "edge";
    audioCache.getCachedAudio.mockResolvedValue(null);
    audioCache.putCachedAudio.mockResolvedValue();
  });

  test("resolveProvider prioritizes Edge when TTS_PROVIDER=edge", () => {
    const resolved = resolveProvider({ voiceId: "en-US-AriaNeural" });
    expect(resolved.providerName).toBe("edge");
  });

  test("synthesizeOrchestrated falls back to LocalTts when Edge fails on macOS", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "darwin" });

    // Mock Edge failure
    edgeService.synthesizeEdgeTts.mockRejectedValue(new edgeService.EdgeTtsError("Socket connection reset by Microsoft"));
    
    // Mock Local fallback success returning a stream/buffer
    const dummyAudio = Buffer.from("fake-mp3-bytes");
    localService.synthesizeChunk.mockResolvedValue(dummyAudio);
    localService.isLocalProviderEnabled.mockReturnValue(true);

    const result = await synthesizeOrchestrated({
      text: "Testing emergency fallback capability.",
      voiceId: "en-US-AriaNeural"
    });

    expect(edgeService.synthesizeEdgeTts).toHaveBeenCalled();
    expect(localService.synthesizeChunk).toHaveBeenCalled();
    expect(result).toEqual(dummyAudio);

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
