const crypto = require("crypto");
const { logger } = require("../observability/logger");
const { extractOrGenerateTraceContext } = require("../observability/tracer");
const { recordHttpRequest } = require("../observability/metrics");

function requestLogger(req, res, next) {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  
  // Extract or generate W3C distributed trace context
  const traceCtx = extractOrGenerateTraceContext(req.headers);
  req.traceId = traceCtx.traceId;
  req.spanId = traceCtx.spanId;
  req.traceparent = traceCtx.traceparent;

  res.setHeader("X-Request-Id", req.id);
  res.setHeader("X-Trace-Id", req.traceId);
  res.setHeader("traceparent", req.traceparent);

  const start = Date.now();
  
  // Log request completion and record metrics on finish
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const url = req.originalUrl || req.url || "/";

    // Record Prometheus metrics
    recordHttpRequest(req.method, url, res.statusCode, durationMs);

    const logPayload = {
      reqId: req.id,
      traceId: req.traceId,
      spanId: req.spanId,
      method: req.method,
      url,
      status: res.statusCode,
      durationMs,
      ip: req.headers["x-forwarded-for"] || req.ip,
      userAgent: req.headers["user-agent"]
    };

    if (res.statusCode >= 500) {
      logger.error(logPayload, "HTTP Request Error");
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload, "HTTP Request Warning");
    } else {
      logger.info(logPayload, "HTTP Request Completed");
    }
  });

  next();
}

module.exports = { requestLogger };
