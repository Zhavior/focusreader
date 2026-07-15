const {
  initSentry,
  captureException,
  captureMessage,
  getCapturedEvents,
  resetSentryEvents,
  sentryErrorMiddleware,
} = require("../../src/observability/sentry");
const {
  recordCacheHit,
  recordCacheMiss,
  getCacheHitRatio,
  getPrometheusMetrics,
  resetMetrics,
} = require("../../src/observability/metrics");

describe("Phase 8 (`Pillar 6`) Observability & APM Sentry Suite", () => {
  beforeEach(() => {
    resetSentryEvents();
    resetMetrics();
  });

  test("initSentry initializes securely in local ring-buffer mode when no DSN provided", () => {
    initSentry({ dsn: null });
    expect(getCapturedEvents()).toEqual([]);
  });

  test("captureException enriches unhandled errors with W3C traceparent and request context", () => {
    const mockErr = new Error("Database deadlock during audio chunk caching");
    mockErr.code = "SQLITE_BUSY";
    mockErr.statusCode = 500;

    const eventId = captureException(mockErr, {
      reqId: "req-123-abc",
      traceId: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      traceparent: "00-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6-ecda4cd12e5fc1cf-01",
      route: "/api/tts/stream",
      method: "POST",
      userId: "user_titanium_01",
      extra: { provider: "edge" },
    });

    expect(eventId).toMatch(/^event_/);
    const events = getCapturedEvents();
    expect(events.length).toBe(1);
    expect(events[0].error.message).toBe("Database deadlock during audio chunk caching");
    expect(events[0].error.code).toBe("SQLITE_BUSY");
    expect(events[0].context.traceparent).toBe("00-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6-ecda4cd12e5fc1cf-01");
    expect(events[0].context.userId).toBe("user_titanium_01");
  });

  test("captureMessage records operational APM events cleanly", () => {
    const msgId = captureMessage("CDN audio prewarm completed for 10 chunks", "info", {
      docId: "doc-999",
    });

    expect(msgId).toMatch(/^msg_/);
    const events = getCapturedEvents();
    expect(events.length).toBe(1);
    expect(events[0].message).toBe("CDN audio prewarm completed for 10 chunks");
    expect(events[0].level).toBe("info");
  });

  test("sentryErrorMiddleware captures 5xx errors and ignores 4xx client operational errors", () => {
    const nextMock = jest.fn();
    const reqMock = { id: "req-500", originalUrl: "/api/tts/stream", method: "POST" };

    const serverErr = new Error("Out of memory during ffmpeg encoding");
    serverErr.statusCode = 500;
    serverErr.isOperational = false;
    sentryErrorMiddleware(serverErr, reqMock, {}, nextMock);

    expect(getCapturedEvents().length).toBe(1);
    expect(nextMock).toHaveBeenCalledWith(serverErr);

    resetSentryEvents();
    const clientErr = new Error("Invalid voice ID provided");
    clientErr.statusCode = 400;
    clientErr.isOperational = true;
    sentryErrorMiddleware(clientErr, reqMock, {}, nextMock);

    expect(getCapturedEvents().length).toBe(0);
    expect(nextMock).toHaveBeenCalledWith(clientErr);
  });

  test("recordCacheHit and recordCacheMiss calculate precise cache hit ratio SLA", () => {
    expect(getCacheHitRatio("audio")).toBe(0);

    recordCacheHit("audio");
    recordCacheHit("audio");
    recordCacheHit("audio");
    recordCacheMiss("audio");

    // 3 hits out of 4 total = 0.75 ratio
    expect(getCacheHitRatio("audio")).toBe(0.75);

    const promOutput = getPrometheusMetrics();
    expect(promOutput).toContain('cache_hits_total{cache_type="audio"} 3');
    expect(promOutput).toContain('cache_misses_total{cache_type="audio"} 1');
  });
});
