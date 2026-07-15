import assert from "assert";
import { isNoiseText } from "../lib/documentParser.ts";

console.log("=== Running Smart Scanner Engine Verification ===");

// 1. Test Page Numbers
assert.strictEqual(isNoiseText("Page 1 of 10"), true, "Should block 'Page 1 of 10'");
assert.strictEqual(isNoiseText("Page 12"), true, "Should block 'Page 12'");
assert.strictEqual(isNoiseText("12 / 45"), true, "Should block '12 / 45'");
assert.strictEqual(isNoiseText(" - 14 - "), true, "Should block '- 14 -'");

// 2. Test Copyrights, Watermarks & Identifiers
assert.strictEqual(isNoiseText("© 2024 Harvard University Press"), true, "Should block copyright notice");
assert.strictEqual(isNoiseText("CONFIDENTIAL AND PROPRIETARY INFORMATION"), true, "Should block confidential notice");
assert.strictEqual(isNoiseText("DOI: 10.1038/s41586-020-2649-2"), true, "Should block DOI line");

// 3. Test Standalone Bullets & Table of Contents Dots
assert.strictEqual(isNoiseText("• • • • •"), true, "Should block bullet row");
assert.strictEqual(isNoiseText(". . . . . . . . . . . . . . ."), true, "Should block TOC dots");
assert.strictEqual(isNoiseText("---"), true, "Should block separator lines");

// 4. Test Figure/Table Numbering
assert.strictEqual(isNoiseText("Figure 3.1:"), true, "Should block Figure numbering header");
assert.strictEqual(isNoiseText("Table 2.4"), true, "Should block Table numbering header");

// 5. Test Boundary Heuristics (Top/Bottom margins with short text)
assert.strictEqual(isNoiseText("FocusReader Document Review Draft", 15, 1100), true, "Should block short top running header");
assert.strictEqual(isNoiseText("FocusReader Document Review Draft", 500, 1100), false, "Should NOT block same text in the middle of the page if valid");

// 6. Test Valid Sentences & Reading Content
assert.strictEqual(isNoiseText("The quick brown fox jumps over the lazy dog."), false, "Should NOT block standard sentence");
assert.strictEqual(isNoiseText("In recent years, quantum computing has made significant strides across multiple hardware architectures."), false, "Should NOT block scientific paragraph");

console.log("✅ All 14 Smart Scanner Engine noise detection tests passed with 100% accuracy!");
