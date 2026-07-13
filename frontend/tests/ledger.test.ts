import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import {
  grantCredits,
  spendCredits,
  revokeAllCredits,
  getCreditBalance,
  hasLedgerHistory,
  __resetDbForTests,
} from "../lib/db";

// tsx --test runs every file in one process, so the suite must claim its own
// DATA_DIR inside before() (module-level env writes would clobber each other).
const DIR = "/tmp/focusreader-test-ledger";
before(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
  process.env.DATA_DIR = DIR;
  __resetDbForTests();
});
after(() => {
  __resetDbForTests();
  fs.rmSync(DIR, { recursive: true, force: true });
});

test("grant then balance", () => {
  grantCredits("u1", 100000, "grant_checkout", "cs_1");
  assert.equal(getCreditBalance("u1"), 100000);
  assert.equal(hasLedgerHistory("u1"), true);
});

test("grants with the same ref are idempotent (duplicate webhook)", () => {
  const first = grantCredits("u2", 100000, "grant_renewal", "in_1");
  const second = grantCredits("u2", 100000, "grant_renewal", "in_1");
  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(getCreditBalance("u2"), 100000);
});

test("spend decrements atomically and rejects overdraft", () => {
  grantCredits("u3", 500, "grant_checkout", "cs_3");
  assert.equal(spendCredits("u3", 200, "track_a"), 300);
  assert.equal(spendCredits("u3", 300, "track_b"), 0);
  // Balance is now exactly 0 — any further spend must fail and write nothing.
  assert.equal(spendCredits("u3", 1, "track_c"), null);
  assert.equal(getCreditBalance("u3"), 0);
});

test("burst of spends can never overspend the balance", () => {
  grantCredits("u4", 1000, "grant_checkout", "cs_4");
  let successes = 0;
  for (let i = 0; i < 20; i++) {
    if (spendCredits("u4", 100, `t_${i}`) !== null) successes++;
  }
  assert.equal(successes, 10); // exactly 1000/100, never more
  assert.equal(getCreditBalance("u4"), 0);
});

test("renewal reset: revoke + grant keyed to invoice id, replay-safe", () => {
  grantCredits("u5", 100000, "grant_checkout", "cs_5");
  spendCredits("u5", 40000, "track_x"); // user consumed 40k → 60k left

  // Renewal arrives: reset to a fresh 100k.
  revokeAllCredits("u5", "renewal-reset:in_5");
  grantCredits("u5", 100000, "grant_renewal", "in_5");
  assert.equal(getCreditBalance("u5"), 100000);

  // Stripe redelivers the same invoice — must be a no-op even after spending.
  spendCredits("u5", 10000, "track_y");
  revokeAllCredits("u5", "renewal-reset:in_5");
  grantCredits("u5", 100000, "grant_renewal", "in_5");
  assert.equal(getCreditBalance("u5"), 90000);
});

test("cancellation zeroes the balance", () => {
  grantCredits("u6", 100000, "grant_checkout", "cs_6");
  spendCredits("u6", 25000, "track_z");
  revokeAllCredits("u6", "cancel:sub_6");
  assert.equal(getCreditBalance("u6"), 0);
});
