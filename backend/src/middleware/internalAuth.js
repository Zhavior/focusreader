const crypto = require("crypto");

/**
 * Guards the TTS engine so it can ONLY be called by our own Next.js server
 * (which performs the Clerk auth + credit checks). Without this, anyone who
 * can reach the backend port could call /api/tts/stream directly and generate
 * audio for free, bypassing billing entirely.
 *
 * The Next proxy sends the shared secret in the `x-internal-secret` header.
 * Comparison is constant-time to avoid leaking the secret via timing.
 */
function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    return res.status(500).json({
      error: "server_misconfigured",
      message: "INTERNAL_API_SECRET is not set on the TTS backend.",
    });
  }

  const provided = req.get("x-internal-secret") || "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Missing or invalid internal service credentials.",
    });
  }

  next();
}

module.exports = { internalAuth };
