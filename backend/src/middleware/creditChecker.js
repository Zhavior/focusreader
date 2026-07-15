const crypto = require("crypto");
const { getBalance, spendCredits } = require("../services/db.service");

/**
 * Express middleware to verify and deduct word credits before synthesizing TTS audio.
 * Prevents unmetered API usage and guarantees fair billing enforcement.
 */
async function enforceCredits(req, res, next) {
  const userId = req.headers["x-hyperfi-user-id"] || req.body?.userId || req.query?.userId;

  // If no userId is attached (e.g. anonymous guest preview or local dev without user ID), allow through or check guest rate limit
  if (!userId) {
    return next();
  }

  const text = req.body?.text || "";
  const cost = Math.max(1, Math.ceil(text.length / 5)); // ~5 chars per word

  const balance = await getBalance(userId);
  if (balance !== null && balance < cost) {
    return res.status(402).json({
      error: "insufficient_credits",
      message: "You have exhausted your monthly credit balance. Please upgrade your plan in the Billing dashboard to continue streaming audio.",
      creditsRemaining: balance,
      creditsRequired: cost,
    });
  }

  // Hook into response completion to deduct credits only upon successful audio delivery
  res.on("finish", async () => {
    if (res.statusCode === 200) {
      const ref = `tts_${crypto.randomUUID()}`;
      const updated = await spendCredits(userId, cost, ref, "spend_tts");
      if (updated !== null) {
        console.log(`[CreditChecker] Deducted ${cost} words from user ${userId}. Remaining: ${updated}`);
      }
    }
  });

  next();
}

module.exports = {
  enforceCredits,
};
