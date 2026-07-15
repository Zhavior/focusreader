const request = require("supertest");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

// Use test database path before loading app
const testDataDir = path.join(__dirname, "../tmp_test_data");
if (!fs.existsSync(testDataDir)) fs.mkdirSync(testDataDir, { recursive: true });
process.env.DATA_DIR = testDataDir;
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error";

const { app, server } = require("../../src/index");
const { getDb, closeDb } = require("../../src/services/db.service");
const edgeService = require("../../src/services/edgeTts.service");

jest.mock("../../src/services/edgeTts.service");

describe("Hardened Extension Integration Suite", () => {
  const testUserId = "user_test_hardening_123";
  const rawToken = "hyptest_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  beforeAll(() => {
    const db = getDb();
    db.exec(`
      CREATE TABLE IF NOT EXISTS extension_tokens (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        delta INTEGER NOT NULL,
        reason TEXT NOT NULL,
        ref TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.prepare("INSERT OR REPLACE INTO extension_tokens (token_hash, user_id) VALUES (?, ?)")
      .run(tokenHash, testUserId);
  });

  afterAll((done) => {
    closeDb();
    if (server && typeof server.close === "function") {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    const db = getDb();
    db.prepare("DELETE FROM credit_ledger WHERE user_id = ?").run(testUserId);
  });

  test("GET /health/live returns 200 OK liveness status", async () => {
    const res = await request(app).get("/health/live");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /health/ready returns 200 OK with deep SQLite and cache probes", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.statusCode).toBe(200);
    expect(res.body.checks.database).toBe(true);
    expect(res.body.checks.audioCache).toBe(true);
  });

  test("POST /api/extension/tts without Bearer header returns 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/extension/tts")
      .send({ text: "Hello world" });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  test("POST /api/extension/tts with invalid token returns 401 Unauthorized", async () => {
    const res = await request(app)
      .post("/api/extension/tts")
      .set("Authorization", "Bearer invalid_fake_token_value_1234567890")
      .send({ text: "Hello world" });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  test("POST /api/extension/tts with 0 balance returns 402 Insufficient Credits", async () => {
    const res = await request(app)
      .post("/api/extension/tts")
      .set("Authorization", `Bearer ${rawToken}`)
      .send({ text: "Hello world" });
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toBe("INSUFFICIENT_CREDITS");
  });

  test("POST /api/extension/tts with valid token and balance synthesizes and deducts atomically", async () => {
    // Add 100 credits
    const db = getDb();
    db.prepare("INSERT INTO credit_ledger (user_id, delta, reason) VALUES (?, ?, ?)")
      .run(testUserId, 100, "test_deposit");

    // Mock Edge TTS returning dummy stream
    const dummyAudio = Buffer.from("fake-mp3-stream-bytes");
    edgeService.synthesizeEdgeTts.mockResolvedValue(dummyAudio);

    const res = await request(app)
      .post("/api/extension/tts")
      .set("Authorization", `Bearer ${rawToken}`)
      .send({ text: "Hello world testing", voiceId: "en-US-AriaNeural" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("audio/mpeg");
    expect(res.headers["x-credits-remaining"]).toBeDefined();

    // Verify atomic deduction from SQLite ledger (100 - length("Hello world testing") = 100 - 19 = 81)
    const row = db.prepare("SELECT SUM(delta) as bal FROM credit_ledger WHERE user_id = ?").get(testUserId);
    expect(row.bal).toBe(100 - "Hello world testing".length);
  });
});
