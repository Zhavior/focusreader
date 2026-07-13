const { ElevenLabsError } = require("../services/elevenlabs.service");

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    // Audio stream already started sending to the client; we can only
    // terminate the connection cleanly at this point.
    console.error("Stream error after headers sent:", err.message);
    return res.end();
  }

  if (err instanceof ElevenLabsError) {
    return res.status(err.statusCode || 502).json({
      error: "elevenlabs_error",
      message: err.message,
    });
  }

  console.error("Unhandled server error:", err);
  return res.status(500).json({
    error: "internal_error",
    message: "Something went wrong while generating audio. Please try again.",
  });
}

module.exports = { errorHandler };
