const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildSpeechScript,
  MAX_CHUNK_CHARS,
  SECTION_TARGET_CHARS,
} = require("../src/services/chunker.service");

const sentence = "The mitochondria is the powerhouse of the cell. ";

test("checkpoints off: behaves like plain chunking", () => {
  const script = buildSpeechScript(sentence.repeat(10), { checkpoints: false });
  assert.equal(script.length, 1);
  assert.ok(!script[0].includes("Checkpoint"));
});

test("short text gets no checkpoint announcements even when enabled", () => {
  const script = buildSpeechScript(sentence.repeat(10), { checkpoints: true });
  assert.equal(script.filter((c) => c.startsWith("Checkpoint")).length, 0);
});

test("long text is divided into sections with announcements between them", () => {
  // ~3 sections worth of text
  const text = sentence.repeat(Math.ceil((SECTION_TARGET_CHARS * 3) / sentence.length));
  const script = buildSpeechScript(text, { checkpoints: true });

  const announcements = script.filter((c) => c.startsWith("Checkpoint"));
  const content = script.filter((c) => !c.startsWith("Checkpoint"));

  // N sections → N-1 announcements, interleaved (never first, never last).
  assert.ok(content.length >= 2);
  assert.equal(announcements.length, content.length - 1);
  assert.ok(!script[0].startsWith("Checkpoint"));
  assert.ok(!script[script.length - 1].startsWith("Checkpoint"));

  // Announcements state correct totals: "section i of N".
  const total = content.length;
  announcements.forEach((a, idx) => {
    assert.ok(
      a.includes(`section ${idx + 2} of ${total}`),
      `unexpected announcement: ${a}`
    );
  });
});

test("every script entry respects the provider chunk limit", () => {
  const text = sentence.repeat(Math.ceil((SECTION_TARGET_CHARS * 5) / sentence.length));
  const script = buildSpeechScript(text, { checkpoints: true });
  for (const entry of script) {
    assert.ok(entry.length <= MAX_CHUNK_CHARS);
  }
});

test("no content is lost when checkpoints are inserted", () => {
  const text = sentence.repeat(Math.ceil((SECTION_TARGET_CHARS * 3) / sentence.length)).trim();
  const script = buildSpeechScript(text, { checkpoints: true });
  const rejoined = script
    .filter((c) => !c.startsWith("Checkpoint"))
    .join(" ")
    .replace(/\s+/g, " ");
  assert.equal(rejoined, text.replace(/\s+/g, " "));
});
