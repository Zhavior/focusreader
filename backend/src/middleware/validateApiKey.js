function validateApiKey(req, res, next) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({
      error: "server_misconfigured",
      message:
        "ELEVENLABS_API_KEY is not set on the server. Add it to backend/.env and restart the server.",
    });
  }
  next();
}

module.exports = { validateApiKey };
