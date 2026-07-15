const { chunkText, buildSpeechScript, MAX_CHUNK_CHARS, SECTION_TARGET_CHARS } = require("../../src/services/chunker.service");

describe("Chunker Service Suite (`chunker.service.js`)", () => {
  test("empty and whitespace input produce no chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
    expect(chunkText(null)).toEqual([]);
  });

  test("short text stays in one chunk", () => {
    expect(chunkText("Hello world.")).toEqual(["Hello world."]);
  });

  test("no chunk ever exceeds MAX_CHUNK_CHARS limit", () => {
    const paragraph = "This is a fairly normal sentence for testing purposes. ".repeat(40);
    const text = Array.from({ length: 30 }, () => paragraph).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });

  test("prefers paragraph boundaries over mid-sentence splits", () => {
    const p1 = "First paragraph. ".repeat(150).trim();  // ~2550 chars
    const p2 = "Second paragraph. ".repeat(150).trim(); // ~2700 chars
    const chunks = chunkText(`${p1}\n\n${p2}`);
    expect(chunks.length).toBe(2);
    expect(chunks[0].startsWith("First")).toBe(true);
    expect(chunks[1].startsWith("Second")).toBe(true);
  });

  test("a single monster sentence is hard-wrapped cleanly on word boundaries rather than dropped", () => {
    const monsterWord = "word ".repeat(1500).trim(); // ~7500 chars
    const chunks = chunkText(monsterWord);
    expect(chunks.every((c) => c.length <= MAX_CHUNK_CHARS)).toBe(true);
    // Verify word boundaries (no words chopped mid-way when spaces exist)
    expect(chunks[0].endsWith("word")).toBe(true);
    expect(chunks[1].startsWith("word")).toBe(true);
  });

  test("abbreviation protection: does not split mid-sentence on honorifics (Mr., Dr., e.g., vs.)", () => {
    const text = "Dr. Smith met with Mr. Jones vs. Gov. Davis outside St. Luke hospital at 8 a.m. They discussed e.g. neuroscience and binaural acoustics.";
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  test("buildSpeechScript when checkpoints=false returns plain chunks", () => {
    const sentence = "The mitochondria is the powerhouse of the cell. ";
    const script = buildSpeechScript(sentence.repeat(10), { checkpoints: false });
    expect(script.length).toBe(1);
    expect(script[0].includes("Checkpoint")).toBe(false);
  });

  test("buildSpeechScript when checkpoints=true inserts section announcements", () => {
    const sentence = "The mitochondria is the powerhouse of the cell. ";
    const text = sentence.repeat(Math.ceil((SECTION_TARGET_CHARS * 3) / sentence.length));
    const script = buildSpeechScript(text, { checkpoints: true });

    const announcements = script.filter((c) => c.startsWith("Checkpoint reached."));
    const content = script.filter((c) => !c.startsWith("Checkpoint reached."));

    expect(content.length).toBeGreaterThanOrEqual(2);
    expect(announcements.length).toBe(content.length - 1);
    expect(script[0].startsWith("Checkpoint reached.")).toBe(false);
    expect(script[script.length - 1].startsWith("Checkpoint reached.")).toBe(false);

    const total = content.length;
    announcements.forEach((a, idx) => {
      expect(a).toContain(`section ${idx + 2} of ${total}`);
    });
  });
});
