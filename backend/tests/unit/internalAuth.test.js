const { internalAuth } = require("../../src/middleware/internalAuth");
const { AuthenticationError, AppError } = require("../../src/utils/errors");

function makeReq(secret) {
  return { get: (name) => (name === "x-internal-secret" ? secret : undefined) };
}

describe("InternalAuth Middleware Unit Suite (`internalAuth.js`)", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = "correct-secret-value";
  });

  test("rejects when no secret header is present by passing AuthenticationError to next", () => {
    let passedErr = null;
    internalAuth(makeReq(undefined), {}, (err) => (passedErr = err));
    expect(passedErr).toBeInstanceOf(AuthenticationError);
  });

  test("rejects a wrong secret by passing AuthenticationError to next", () => {
    let passedErr = null;
    internalAuth(makeReq("wrong"), {}, (err) => (passedErr = err));
    expect(passedErr).toBeInstanceOf(AuthenticationError);
  });

  test("rejects a same-length wrong secret (timing-safe path) by passing AuthenticationError to next", () => {
    let passedErr = null;
    internalAuth(makeReq("correct-secret-valuX"), {}, (err) => (passedErr = err));
    expect(passedErr).toBeInstanceOf(AuthenticationError);
  });

  test("accepts the correct secret and calls next() with no arguments", () => {
    let passedErr = "not-called";
    internalAuth(makeReq("correct-secret-value"), {}, (err) => (passedErr = err));
    expect(passedErr).toBeUndefined();
  });

  test("fails closed when the server has no secret configured by passing AppError(500) to next", () => {
    delete process.env.INTERNAL_API_SECRET;
    let passedErr = null;
    internalAuth(makeReq("anything"), {}, (err) => (passedErr = err));
    expect(passedErr).toBeInstanceOf(AppError);
    expect(passedErr.statusCode).toBe(500);
  });
});
