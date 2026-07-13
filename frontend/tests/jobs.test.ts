import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import {
  createTrack,
  createJob,
  claimNextJob,
  finishJob,
  getJob,
  __resetDbForTests,
} from "../lib/db";

const DIR = "/tmp/focusreader-test-jobs";
before(() => {
  fs.rmSync(DIR, { recursive: true, force: true });
  process.env.DATA_DIR = DIR;
  __resetDbForTests();
});
after(() => {
  __resetDbForTests();
  fs.rmSync(DIR, { recursive: true, force: true });
});

function enqueue(userId: string, text: string) {
  const track = createTrack({
    userId,
    title: "t",
    chars: text.length,
    speed: 1.5,
    background: "brown_noise",
  });
  return createJob({ userId, trackId: track.id, text, speed: 1.5, background: "brown_noise" });
}

test("jobs are claimed oldest-first and exactly once", () => {
  const a = enqueue("u1", "first");
  const b = enqueue("u1", "second");

  const claimed1 = claimNextJob();
  const claimed2 = claimNextJob();
  const claimed3 = claimNextJob();

  assert.equal(claimed1?.id, a.id);
  assert.equal(claimed1?.status, "running");
  assert.equal(claimed2?.id, b.id);
  assert.equal(claimed3, undefined); // nothing left — no double-claims
});

test("finishJob records success and failure", () => {
  const ok = enqueue("u2", "will succeed");
  const bad = enqueue("u2", "will fail");
  claimNextJob();
  claimNextJob();

  finishJob(ok.id);
  finishJob(bad.id, "ElevenLabs exploded");

  assert.equal(getJob(ok.id, "u2")?.status, "done");
  const failed = getJob(bad.id, "u2");
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "ElevenLabs exploded");
});

test("job status reads are ownership-scoped", () => {
  const job = enqueue("owner", "private text");
  assert.equal(getJob(job.id, "other_user"), undefined);
});
