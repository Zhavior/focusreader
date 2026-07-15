const request = require("supertest");
const express = require("express");
const {
  recordHttpRequest,
  recordTtsSynthesis,
  recordTtsFailover,
  setActiveConnections,
  getPrometheusMetrics,
  resetMetrics,
} = require("../../src/observability/metrics");
const { extractOrGenerateTraceContext, injectTraceContext } = require("../../src/observability/tracer");
const { requestLogger } = require("../../src/middleware/requestLogger");

const app = express();
app.use(requestLogger);

app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(getPrometheusMetrics());
});

app.get("/test-trace", (req, res) => {
  res.json({ traceId: req.traceId, spanId: req.spanId, traceparent: req.traceparent });
});

describe("Phase 5 Observability, Prometheus Metrics & W3C Distributed Tracing Integration Suite", () => {
  beforeEach(() => {
    resetMetrics();
  });

  test("metrics registry accurately tracks HTTP request volume and duration buckets", () => {
    recordHttpRequest("POST", "/api/tts", 200, 120);
    recordHttpRequest("POST", "/api/tts", 200, 45);
    recordHttpRequest("GET", "/health/live", 200, 5);

    const metricsText = getPrometheusMetrics();
    expect(metricsText).toContain("# HELP http_requests_total");
    expect(metricsText).toContain("# TYPE http_requests_total counter");
    expect(metricsText).toContain('http_requests_total{method="POST",route="/api/tts",status_code="200"} 2');
    expect(metricsText).toContain('http_requests_total{method="GET",route="/health/live",status_code="200"} 1');

    expect(metricsText).toContain("# HELP http_request_duration_ms");
    expect(metricsText).toContain('http_request_duration_ms_count{method="POST",route="/api/tts",status_code="200"} 2');
    expect(metricsText).toContain('http_request_duration_ms_bucket{method="POST",route="/api/tts",status_code="200",le="100"} 1');
    expect(metricsText).toContain('http_request_duration_ms_bucket{method="POST",route="/api/tts",status_code="200",le="250"} 2');
  });

  test("metrics registry accurately tracks TTS synthesis latency and multi-tier failovers", () => {
    recordTtsSynthesis("edge", "en-US-JennyNeural", "success", 310);
    recordTtsSynthesis("local", "en-US-JennyNeural", "success", 180);
    recordTtsFailover("edge", "local", "timeout");

    const metricsText = getPrometheusMetrics();
    expect(metricsText).toContain("# HELP tts_synthesis_duration_ms");
    expect(metricsText).toContain('tts_synthesis_duration_ms_count{provider="edge",status="success",voice_id="en-US-JennyNeural"} 1');
    expect(metricsText).toContain('tts_synthesis_duration_ms_count{provider="local",status="success",voice_id="en-US-JennyNeural"} 1');

    expect(metricsText).toContain("# HELP tts_failover_total");
    expect(metricsText).toContain('tts_failover_total{from_provider="edge",reason="timeout",to_provider="local"} 1');
  });

  test("setActiveConnections gauge tracks real-time socket connections", () => {
    setActiveConnections(42);
    const metricsText = getPrometheusMetrics();
    expect(metricsText).toContain("active_connections 42");
  });

  test("GET /metrics endpoint returns formatted Prometheus text output over HTTP", async () => {
    recordHttpRequest("GET", "/metrics", 200, 10);
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.text).toContain("http_requests_total");
  });

  test("tracer extracts parent traceId and generates child spanId when valid traceparent provided", () => {
    const incomingTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
    const ctx = extractOrGenerateTraceContext({ traceparent: incomingTraceparent });

    expect(ctx.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(ctx.parentSpanId).toBe("00f067aa0ba902b7");
    expect(ctx.traceFlags).toBe("01");
    expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(ctx.spanId).not.toBe(ctx.parentSpanId);
    expect(ctx.traceparent).toBe(`00-${ctx.traceId}-${ctx.spanId}-01`);
  });

  test("tracer generates brand new traceId and spanId when traceparent is missing or malformed", () => {
    const ctx = extractOrGenerateTraceContext({});
    expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(ctx.traceparent).toBe(`00-${ctx.traceId}-${ctx.spanId}-01`);
  });

  test("requestLogger middleware injects W3C traceparent and X-Trace-Id into response headers and request context", async () => {
    const parentTraceId = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
    const incomingTraceparent = `00-${parentTraceId}-1122334455667788-01`;

    const res = await request(app)
      .get("/test-trace")
      .set("traceparent", incomingTraceparent);

    expect(res.status).toBe(200);
    expect(res.headers["x-trace-id"]).toBe(parentTraceId);
    expect(res.headers["traceparent"]).toMatch(new RegExp(`^00-${parentTraceId}-[0-9a-f]{16}-01$`));
    expect(res.body.traceId).toBe(parentTraceId);
    expect(res.body.spanId).not.toBe("1122334455667788");
  });
});
