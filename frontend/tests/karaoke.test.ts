import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWordTimings, wordIndexAt } from "../lib/karaoke";

test("empty text yields no tokens", () => {
  assert.deepEqual(buildWordTimings(""), []);
  assert.deepEqual(buildWordTimings("  \n\n  "), []);
});

test("tokens cover [0,1] contiguously and monotonically", () => {
  const tokens = buildWordTimings(
    "Attention is a muscle. It tires quickly without checkpoints."
  );
  assert.ok(tokens.length > 0);
  assert.equal(tokens[0].startFrac, 0);
  assert.equal(tokens[tokens.length - 1].endFrac, 1);
  for (let i = 0; i < tokens.length; i++) {
    assert.ok(tokens[i].endFrac > tokens[i].startFrac);
    if (i > 0) assert.equal(tokens[i].startFrac, tokens[i - 1].endFrac);
  }
});

test("longer words get proportionally more time", () => {
  const tokens = buildWordTimings("a extraordinarily");
  const short = tokens[0].endFrac - tokens[0].startFrac;
  const long = tokens[1].endFrac - tokens[1].startFrac;
  assert.ok(long > short * 3);
});

test("paragraph starts are marked", () => {
  const tokens = buildWordTimings("First paragraph here.\n\nSecond one begins.");
  const starts = tokens.filter((t) => t.paragraphStart).map((t) => t.word);
  assert.deepEqual(starts, ["First", "Second"]);
});

test("wordIndexAt finds the active word and clamps the edges", () => {
  const tokens = buildWordTimings("one two three four five");
  assert.equal(wordIndexAt(tokens, -0.5), 0);
  assert.equal(wordIndexAt(tokens, 0), 0);
  assert.equal(wordIndexAt(tokens, 0.999), tokens.length - 1);
  assert.equal(wordIndexAt(tokens, 1.5), tokens.length - 1);

  // Every token's midpoint must resolve to that token.
  tokens.forEach((t, i) => {
    const mid = (t.startFrac + t.endFrac) / 2;
    assert.equal(wordIndexAt(tokens, mid), i);
  });
});

test("binary search stays correct on a large document", () => {
  const words = Array.from({ length: 30000 }, (_, i) => `word${i}`).join(" ");
  const tokens = buildWordTimings(words);
  assert.equal(tokens.length, 30000);

  // Binary search must agree with a linear reference scan at arbitrary points.
  const linearScan = (frac: number) =>
    tokens.findIndex((t) => frac < t.endFrac);
  for (const frac of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    assert.equal(wordIndexAt(tokens, frac), linearScan(frac));
  }
  const t = tokens[12345];
  assert.equal(wordIndexAt(tokens, (t.startFrac + t.endFrac) / 2), 12345);
});
