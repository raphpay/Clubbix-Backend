const express = require("express");
const router = express.Router();
const { stripe, validateStripeConfig } = require("../config/stripe");

// Middleware to validate Stripe configuration
const validateStripe = (req, res, next) => {
  try {
    validateStripeConfig();
    next();
  } catch (error) {
    res.status(500).json({
      error: "Stripe configuration error",
      message: error.message,
    });
  }
};

// Get Stripe account information
router.get("/account", validateStripe, async (req, res) => {
  try {
    const account = await stripe.accounts.retrieve();
    res.json({
      success: true,
      account: {
        id: account.id,
        business_type: account.business_type,
        country: account.country,
        created: account.created,
        default_currency: account.default_currency,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create a payment intent
router.post("/payment-intents", validateStripe, async (req, res) => {
  try {
    const { amount, currency = "usd", description } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        error: "Amount is required",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency,
      description: description || "Payment for Clubbix service",
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get payment intent status
router.get("/payment-intents/:id", validateStripe, async (req, res) => {
  try {
    const { id } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(id);

    res.json({
      success: true,
      payment_intent: {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get publishable key (for frontend)
router.get("/publishable-key", (req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return res.status(500).json({
      success: false,
      error: "Publishable key not configured",
    });
  }

  res.json({
    success: true,
    publishable_key: publishableKey,
  });
});

module.exports = router;
