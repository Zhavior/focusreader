const { test } = require("node:test");
const assert = require("node:assert/strict");
const { chunkText, MAX_CHUNK_CHARS } = require("../src/services/chunker.service");

test("empty and whitespace input produce no chunks", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("short text stays in one chunk", () => {
  assert.deepEqual(chunkText("Hello world."), ["Hello world."]);
});

test("no chunk ever exceeds the limit", () => {
  const paragraph = "This is a fairly normal sentence for testing purposes. ".repeat(40);
  const text = Array.from({ length: 30 }, () => paragraph).join("\n\n");
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= MAX_CHUNK_CHARS, `chunk of ${chunk.length} chars exceeds ${MAX_CHUNK_CHARS}`);
  }
});

test("prefers paragraph boundaries over mid-sentence splits", () => {
  const p1 = "First paragraph. ".repeat(150).trim();  // ~2550 chars
  const p2 = "Second paragraph. ".repeat(150).trim(); // ~2700 chars
  const chunks = chunkText(`${p1}\n\n${p2}`);
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].startsWith("First"));
  assert.ok(chunks[1].startsWith("Second"));
});

test("a single monster sentence is hard-wrapped rather than dropped", () => {
  const monster = "a".repeat(MAX_CHUNK_CHARS * 2 + 100);
  const chunks = chunkText(monster);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  assert.ok(chunks.every((c) => c.length <= MAX_CHUNK_CHARS));
  assert.equal(total, monster.length);
});

test("no content is lost across chunking", () => {
  const text = Array.from(
    { length: 200 },
    (_, i) => `Sentence number ${i} carries some payload words.`
  ).join(" ");
  const chunks = chunkText(text);
  const rejoined = chunks.join(" ").replace(/\s+/g, " ");
  assert.equal(rejoined, text.replace(/\s+/g, " "));
});
