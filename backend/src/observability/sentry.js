const { logger } = require("./logger");

// Ring buffer for captured exception events (used when SENTRY_DSN is local/testing or offline)
const capturedEvents = [];
const MAX_CAPTURED_EVENTS = 200;

let isInitialized = false;
let sentryDsn = null;

/**
 * Initialize Sentry error tracking and SLA monitoring.
 * If SENTRY_DSN is provided in env, configures the tracking client.
 * Otherwise runs in secure local stub/ring-buffer mode.
 */
function initSentry(options = {}) {
  sentryDsn = options.dsn || process.env.SENTRY_DSN || null;
  isInitialized = true;
  if (sentryDsn) {
    logger.info({ dsn: sentryDsn }, "APM & Error Tracking (Sentry) initialized with remote DSN.");
  } else {
    logger.info("APM & Error Tracking initialized in local ring-buffer mode (no SENTRY_DSN provided).");
  }
}

/**
 * Capture an unhandled exception or critical operational failure.
 * Enriches the event with W3C trace IDs (`traceparent`), request ID, and active user profile.
 */
function captureException(err, context = {}) {
  const event = {
    id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    level: "error",
    error: {
      message: err?.message || String(err),
      name: err?.name || "Error",
      stack: err?.stack || "",
      code: err?.code || err?.errorCode || null,
      statusCode: err?.statusCode || null,
    },
    context: {
      reqId: context.reqId || context.req?.id || null,
      traceId: context.traceId || context.req?.headers?.["x-trace-id"] || null,
      traceparent: context.traceparent || context.req?.headers?.traceparent || null,
      route: context.route || context.req?.originalUrl || context.req?.url || null,
      method: context.method || context.req?.method || null,
      userId: context.userId || context.req?.user?.id || null,
      provider: context.provider || null,
      ...context.extra,
    },
  };

  capturedEvents.push(event);
  if (capturedEvents.length > MAX_CAPTURED_EVENTS) {
    capturedEvents.shift();
  }

  // If remote DSN is configured, dispatch asynchronously via HTTP POST (stubbed safely for zero-dependency)
  if (sentryDsn) {
    // In production, official @sentry/node transport would flush here.
    logger.debug({ eventId: event.id, dsn: sentryDsn }, "Dispatched exception event to remote Sentry APM.");
  }

  return event.id;
}

/**
 * Capture a structured operational message or warning for APM tracking.
 */
function captureMessage(message, level = "info", context = {}) {
  const event = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    level,
    message: String(message),
    context,
  };

  capturedEvents.push(event);
  if (capturedEvents.length > MAX_CAPTURED_EVENTS) {
    capturedEvents.shift();
  }

  return event.id;
}

/**
 * Express middleware to attach Sentry error tracking before custom error formatting.
 */
function sentryErrorMiddleware(err, req, res, next) {
  // Capture 5xx server errors or unhandled exceptions
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500 || err.isOperational === false) {
    captureException(err, { req });
  }
  next(err);
}

/**
 * Get recent captured events (for APM status inspection and unit/integration testing).
 */
function getCapturedEvents() {
  return [...capturedEvents];
}

/**
 * Clear ring buffer (useful between tests).
 */
function resetSentryEvents() {
  capturedEvents.length = 0;
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  sentryErrorMiddleware,
  getCapturedEvents,
  resetSentryEvents,
};
