import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateSeconds, formatDuration, estimateLabel } from "../lib/duration";

test("estimateSeconds scales with chars and inversely with speed", () => {
  assert.equal(estimateSeconds(0), 0);
  assert.equal(estimateSeconds(950, 1.0), 60);
  assert.equal(estimateSeconds(950, 2.0), 30);
  assert.equal(estimateSeconds(1900, 1.0), 120);
});

test("estimateSeconds tolerates a zero/invalid speed", () => {
  assert.equal(estimateSeconds(950, 0), 60);
});

test("formatDuration picks sensible units", () => {
  assert.equal(formatDuration(45), "45s");
  assert.equal(formatDuration(0.4), "1s"); // never shows 0s for nonzero input
  assert.equal(formatDuration(60), "1 min");
  assert.equal(formatDuration(26 * 60), "26 min");
  assert.equal(formatDuration(65 * 60), "1h 05m");
});

test("estimateLabel end-to-end", () => {
  // A 47-minute PDF at 1.8x ≈ 26 minutes — the marquee example.
  const chars = 47 * 950;
  assert.equal(estimateLabel(chars, 1.8), "26 min");
});
