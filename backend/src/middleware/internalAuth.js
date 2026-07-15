const crypto = require("crypto");
const { AuthenticationError, AppError } = require("../utils/errors");

function internalAuth(req, res, next) {
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    return next(new AppError("INTERNAL_API_SECRET is not set on the TTS backend.", 500, "SERVER_MISCONFIGURED", false));
  }

  const provided = req.get("x-internal-secret") || "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return next(new AuthenticationError("Missing or invalid internal service credentials."));
  }

  next();
}

module.exports = { internalAuth };
