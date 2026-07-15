const crypto = require("crypto");
const { getDb } = require("../services/db.service");
const { AuthenticationError } = require("../utils/errors");

const TOKEN_REGEX = /^[a-zA-Z0-9_-]{16,128}$/;

async function resolveToken(rawToken) {
  try {
    const dbService = require("../services/db.service");
    if (typeof dbService.resolveExtensionToken === "function") {
      const resolved = await Promise.resolve(dbService.resolveExtensionToken(rawToken));
      if (resolved) return resolved;
    }
  } catch (err) {
    // fallthrough to raw query
  }
  try {
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const row = getDb()
      .prepare("SELECT user_id FROM extension_tokens WHERE token_hash = ?")
      .get(hash);
    return row ? row.user_id : null;
  } catch (err) {
    return null;
  }
}

async function extensionAuth(req, res, next) {
  const authHeader = req.get("Authorization") || "";
  let rawToken = "";
  if (authHeader.startsWith("Bearer ")) {
    rawToken = authHeader.slice(7).trim();
  } else if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(";").reduce((acc, c) => {
      const [k, v] = c.trim().split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    rawToken = cookies["__session"] || cookies["hyperfi_session"] || "";
  }

  if (!rawToken || !TOKEN_REGEX.test(rawToken)) {
    return next(new AuthenticationError("Missing Authorization Bearer token header or valid session cookie."));
  }

  const userId = await resolveToken(rawToken);
  if (!userId) {
    return next(
      new AuthenticationError(
        "Invalid or revoked extension token. Generate a new one in Dashboard → Tools."
      )
    );
  }

  req.userId = userId;
  next();
}

module.exports = { extensionAuth, resolveToken };
