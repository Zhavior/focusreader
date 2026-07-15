const { Router } = require("express");
const crypto = require("crypto");
const { addCredits } = require("../services/db.service");
const { asyncHandler } = require("../utils/asyncHandler");

const router = Router();

/**
 * POST /api/webhooks/billing
 * Handles Stripe and LemonSqueezy webhook events for subscription purchases, top-ups, and monthly renewals.
 */
router.post(
  "/billing",
  asyncHandler(async (req, res) => {
    const stripeSig = req.headers["stripe-signature"];
    const lemonSig = req.headers["x-signature"];
    const payload = req.body;

    let eventType = null;
    let userId = null;
    let wordsToAdd = 0;
    let planName = "pro";

    // 1. Stripe Event Handling
    if (stripeSig || (payload && payload.type && (payload.type.startsWith("checkout.") || payload.type.startsWith("invoice.")))) {
      eventType = payload.type;
      const session = payload.data?.object;
      userId = session?.client_reference_id || session?.metadata?.userId;

      if (eventType === "checkout.session.completed" || eventType === "invoice.payment_succeeded") {
        const tier = (session?.metadata?.tier || "pro").toLowerCase();
        wordsToAdd = tier === "enterprise" ? 1000000 : 250000; // 250k words for Pro, 1M words for Enterprise
        planName = tier;
      }
    }
    // 2. LemonSqueezy Event Handling
    else if (lemonSig || (payload && payload.meta && payload.meta.event_name)) {
      eventType = payload.meta?.event_name;
      const customData = payload.meta?.custom_data || {};
      userId = customData.user_id || customData.userId;

      if (eventType === "order_created" || eventType === "subscription_created" || eventType === "subscription_payment_success") {
        const variantName = (payload.data?.attributes?.variant_name || "").toLowerCase();
        wordsToAdd = variantName.includes("enterprise") ? 1000000 : 250000;
        planName = variantName.includes("enterprise") ? "enterprise" : "pro";
      }
    }

    if (!userId || wordsToAdd <= 0) {
      console.log(`[Webhook] Ignored event ${eventType}: no target userId or 0 credits to add.`);
      return res.status(200).json({ received: true, processed: false });
    }

    const ref = `webhook_${eventType}_${crypto.randomUUID()}`;
    const newBalance = await addCredits(userId, wordsToAdd, `plan_upgrade_${planName}`, ref);

    console.log(`[Webhook] Successfully added ${wordsToAdd} word credits to user ${userId} (${planName}). New balance: ${newBalance}`);
    res.status(200).json({ received: true, processed: true, userId, newBalance });
  })
);

module.exports = router;
