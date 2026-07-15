const { ElevenLabsError } = require("../services/elevenlabs.service");
const { EdgeTtsError } = require("../services/edgeTts.service");
const { OpenSourceTtsError } = require("../services/openSourceTts.service");
const { LocalTtsError } = require("../services/localTts.service");
const { AppError } = require("../utils/errors");
const { logger } = require("../observability/logger");
const { captureException } = require("../observability/sentry");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    logger.error({ reqId: req?.id, err: { message: err.message, stack: err.stack } }, "Stream error after headers sent — closing socket.");
    return res.end();
  }

  let statusCode = err.statusCode || 500;
  let errorCode = err.errorCode || "INTERNAL_SERVER_ERROR";
  let retryable = Boolean(err.retryable);

  // Map known provider errors to 502 Bad Gateway with retry flag
  if (err instanceof ElevenLabsError) {
    statusCode = err.statusCode || 502;
    errorCode = "PROVIDER_ELEVENLABS_ERROR";
    retryable = true;
  } else if (err instanceof EdgeTtsError) {
    statusCode = 502;
    errorCode = "PROVIDER_EDGE_ERROR";
    retryable = true;
  } else if (err instanceof OpenSourceTtsError) {
    statusCode = 502;
    errorCode = "PROVIDER_OPENSOURCE_ERROR";
    retryable = true;
  } else if (err instanceof LocalTtsError) {
    statusCode = 502;
    errorCode = "PROVIDER_LOCAL_ERROR";
    retryable = true;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    retryable = err.retryable;
  }

  const logPayload = {
    reqId: req?.id,
    statusCode,
    errorCode,
    retryable,
    err: {
      message: err.message,
      stack: err.stack
    }
  };

  if (statusCode >= 500 || err.isOperational === false) {
    logger.error(logPayload, "Unhandled Server Error");
    captureException(err, {
      reqId: req?.id,
      traceparent: req?.headers?.traceparent || req?.traceparent,
      route: req?.originalUrl || req?.url,
      method: req?.method,
      userId: req?.user?.id,
      extra: { errorCode, statusCode }
    });
  } else {
    logger.warn(logPayload, "Client or Upstream Operational Error");
  }

  return res.status(statusCode).json({
    error: errorCode,
    message: err.message,
    retryable,
    request_id: req?.id || null,
    timestamp: new Date().toISOString()
  });
}

module.exports = { errorHandler };
