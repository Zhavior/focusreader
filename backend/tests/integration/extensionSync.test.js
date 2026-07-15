const request = require("supertest");
const express = require("express");
const extensionRoutes = require("../../src/routes/extension.routes");
const { requestLogger } = require("../../src/middleware/requestLogger");
const { errorHandler } = require("../../src/middleware/errorHandler");

// Mock SQLite / Prisma database layer for clean deterministic extension sync verification
const mockDb = new Map();
mockDb.set("token_extension_user", {
  id: "user-ext-101",
  email: "adhd.reader@hyperfi.ai",
  tier: "pro",
  credits_remaining: 100
});
mockDb.set("token_low_balance", {
  id: "user-ext-102",
  email: "free@hyperfi.ai",
  tier: "free",
  credits_remaining: 0
});

jest.mock("../../src/services/db.service", () => ({
  resolveExtensionToken: jest.fn(async (token) => {
    const user = mockDb.get(token);
    return user ? user.id : null;
  }),
  getBalance: jest.fn(async (userId) => {
    for (const [token, u] of mockDb.entries()) {
      if (u.id === userId) return u.credits_remaining;
    }
    return 0;
  }),
  spendCreditsAtomic: jest.fn(async (userId, amount) => {
    for (const [token, u] of mockDb.entries()) {
      if (u.id === userId) {
        if (u.credits_remaining < amount) {
          const { InsufficientCreditsError } = require("../../src/utils/errors");
          throw new InsufficientCreditsError("Out of credits — open Billing to upgrade.");
        }
        u.credits_remaining -= amount;
        return u.credits_remaining;
      }
    }
    const { InsufficientCreditsError } = require("../../src/utils/errors");
    throw new InsufficientCreditsError("Out of credits — open Billing to upgrade.");
  }),
}));

jest.mock("../../src/services/ttsOrchestrator.service", () => ({
  synthesizeOrchestrated: jest.fn().mockImplementation(async ({ text }) => {
    return Buffer.from(`RIFF_MOCK_WAV_${text.slice(0, 10)}`);
  }),
}));

const app = express();
app.use(express.json());
app.use(requestLogger);
app.use("/api/extension", extensionRoutes);
app.use(errorHandler);

describe("Phase 6 Chrome Extension V3 Production Sync & W3C Tracing Suite", () => {
  beforeEach(() => {
    mockDb.get("token_extension_user").credits_remaining = 100;
  });

  test("GET /api/extension/token checks session health and returns user profile with W3C trace preservation", async () => {
    const extTraceId = "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6";
    const extTraceparent = `00-${extTraceId}-1234567890abcdef-01`;

    const res = await request(app)
      .get("/api/extension/token")
      .set("Authorization", "Bearer token_extension_user")
      .set("traceparent", extTraceparent);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("authenticated");
    expect(res.body.user.id).toBe("user-ext-101");
    expect(res.headers["x-trace-id"]).toBe(extTraceId);
    expect(res.headers["traceparent"]).toMatch(new RegExp(`^00-${extTraceId}-[0-9a-f]{16}-01$`));
  });

  test("GET /api/extension/token authenticates via __session cookie (One-Click Tokenless Auth)", async () => {
    const res = await request(app)
      .get("/api/extension/token")
      .set("Cookie", "__session=token_extension_user");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("authenticated");
    expect(res.body.user.id).toBe("user-ext-101");
  });

  test("POST /api/extension/tts handles audio prewarm from content script with active W3C traceparent", async () => {
    const extTraceId = "3344556677889900aabbccddeeff1122";
    const extTraceparent = `00-${extTraceId}-fedcba0987654321-01`;

    const res = await request(app)
      .post("/api/extension/tts")
      .set("Authorization", "Bearer token_extension_user")
      .set("traceparent", extTraceparent)
      .send({ text: "Supercharge reading comprehension with binaural acoustics." });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("audio/mpeg");
    expect(res.headers["x-trace-id"]).toBe(extTraceId);
    expect(res.headers["x-credits-deducted"]).toBe("58");
    expect(mockDb.get("token_extension_user").credits_remaining).toBe(42);
  });

  test("POST /api/extension/tts returns 402 when credits depleted while preserving trace context", async () => {
    const extTraceId = "ffeeddccbbaa99887766554433221100";
    const res = await request(app)
      .post("/api/extension/tts")
      .set("Authorization", "Bearer token_low_balance")
      .set("traceparent", `00-${extTraceId}-1111222233334444-01`)
      .send({ text: "This chunk requires credits." });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_CREDITS");
    expect(res.headers["x-trace-id"]).toBe(extTraceId);
  });
});
