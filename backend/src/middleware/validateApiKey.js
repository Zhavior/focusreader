const { AuthenticationError, AppError } = require("../utils/errors");

function validateApiKey(req, res, next) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return next(new AppError("ELEVENLABS_API_KEY is not set on the server. Add it to backend/.env and restart the server.", 500, "SERVER_MISCONFIGURED", false));
  }
  next();
}

module.exports = { validateApiKey };
