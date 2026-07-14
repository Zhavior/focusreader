import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  issueExtensionToken,
  resolveExtensionToken,
  revokeExtensionTokens,
  createImport,
  claimImport,
  __resetDbForTests,
} from "../lib/db";

const DIR = "/tmp/focusreader-test-exttokens";
before(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
  process.env.DATA_DIR = DIR;
  __resetDbForTests();
});
after(() => {
  __resetDbForTests();
  fs.rmSync(DIR, { recursive: true, force: true });
});

test("issued token resolves to its user", () => {
  const token = issueExtensionToken("user_a");
  assert.ok(token.startsWith("frk_"));
  assert.equal(resolveExtensionToken(token), "user_a");
});

test("a raw Clerk user id is NOT a valid token", () => {
  issueExtensionToken("user_b");
  // The exact attack the old design allowed: presenting the user id itself.
  assert.equal(resolveExtensionToken("user_b"), null);
});

test("garbage and empty tokens resolve to null", () => {
  assert.equal(resolveExtensionToken(""), null);
  assert.equal(resolveExtensionToken("frk_deadbeef"), null);
  assert.equal(resolveExtensionToken("Bearer nonsense"), null);
});

test("re-issuing revokes the previous token", () => {
  const first = issueExtensionToken("user_c");
  const second = issueExtensionToken("user_c");
  assert.equal(resolveExtensionToken(first), null);
  assert.equal(resolveExtensionToken(second), "user_c");
});

test("explicit revocation kills the token", () => {
  const token = issueExtensionToken("user_d");
  revokeExtensionTokens("user_d");
  assert.equal(resolveExtensionToken(token), null);
});

test("imports are claim-once", () => {
  const imported = createImport("captured article text");
  assert.equal(claimImport(imported.id)?.text, "captured article text");
  assert.equal(claimImport(imported.id), undefined); // second claim fails
});

test("oversized imports are capped at 200k chars", () => {
  const huge = createImport("x".repeat(300000));
  assert.equal(claimImport(huge.id)?.text.length, 200000);
});
