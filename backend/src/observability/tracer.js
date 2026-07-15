const crypto = require("crypto");

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

function generateTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

function generateSpanId() {
  return crypto.randomBytes(8).toString("hex");
}

function extractOrGenerateTraceContext(headers = {}) {
  const traceparent = headers.traceparent || headers.Traceparent || headers["x-traceparent"];
  let traceId = null;
  let parentSpanId = null;
  let traceFlags = "01";

  if (traceparent && typeof traceparent === "string") {
    const match = traceparent.trim().match(TRACEPARENT_REGEX);
    if (match && match[1] !== "00000000000000000000000000000000" && match[2] !== "0000000000000000") {
      traceId = match[1].toLowerCase();
      parentSpanId = match[2].toLowerCase();
      traceFlags = match[3].toLowerCase();
    }
  }

  // Fallback to x-trace-id if traceparent wasn't valid
  if (!traceId) {
    const fallbackId = headers["x-trace-id"] || headers["x-request-id"];
    if (fallbackId && typeof fallbackId === "string" && /^[0-9a-f]{32}$/i.test(fallbackId)) {
      traceId = fallbackId.toLowerCase();
    } else {
      traceId = generateTraceId();
    }
  }

  const spanId = generateSpanId();
  const formattedTraceparent = `00-${traceId}-${spanId}-${traceFlags}`;

  return {
    traceId,
    spanId,
    parentSpanId,
    traceFlags,
    traceparent: formattedTraceparent,
  };
}

function injectTraceContext(headers = {}, context = {}) {
  const { traceId, spanId, traceFlags = "01" } = context;
  if (!traceId || !spanId) return { ...headers };

  return {
    ...headers,
    traceparent: `00-${traceId}-${spanId}-${traceFlags}`,
    "x-trace-id": traceId,
  };
}

module.exports = {
  extractOrGenerateTraceContext,
  injectTraceContext,
  generateTraceId,
  generateSpanId,
};
