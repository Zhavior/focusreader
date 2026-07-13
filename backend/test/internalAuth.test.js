const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { internalAuth } = require("../src/middleware/internalAuth");

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function makeReq(secret) {
  return { get: (name) => (name === "x-internal-secret" ? secret : undefined) };
}

beforeEach(() => {
  process.env.INTERNAL_API_SECRET = "correct-secret-value";
});

test("rejects when no secret header is present", () => {
  const res = makeRes();
  let nextCalled = false;
  internalAuth(makeReq(undefined), res, () => (nextCalled = true));
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a wrong secret", () => {
  const res = makeRes();
  let nextCalled = false;
  internalAuth(makeReq("wrong"), res, () => (nextCalled = true));
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a same-length wrong secret (timing-safe path)", () => {
  const res = makeRes();
  let nextCalled = false;
  internalAuth(makeReq("correct-secret-valuX"), res, () => (nextCalled = true));
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("accepts the correct secret", () => {
  const res = makeRes();
  let nextCalled = false;
  internalAuth(makeReq("correct-secret-value"), res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("fails closed when the server has no secret configured", () => {
  delete process.env.INTERNAL_API_SECRET;
  const res = makeRes();
  let nextCalled = false;
  internalAuth(makeReq("anything"), res, () => (nextCalled = true));
  assert.equal(res.statusCode, 500);
  assert.equal(nextCalled, false);
});
