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

// Create Stripe Checkout session for subscriptions
router.post("/checkout-sessions", validateStripe, async (req, res) => {
  try {
    const {
      price_id,
      success_url,
      cancel_url,
      customer_email,
      mode = "subscription",
      metadata = {},
    } = req.body;

    if (!price_id) {
      return res.status(400).json({
        success: false,
        error: "Price ID is required for subscription checkout",
      });
    }

    if (!success_url || !cancel_url) {
      return res.status(400).json({
        success: false,
        error: "Success URL and Cancel URL are required",
      });
    }

    const sessionParams = {
      mode: mode,
      payment_method_types: ["card"],
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      success_url: success_url,
      cancel_url: cancel_url,
      metadata: metadata,
    };

    // Add customer email if provided
    if (customer_email) {
      sessionParams.customer_email = customer_email;
    }

    // Add subscription data for subscription mode
    if (mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: metadata,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.json({
      success: true,
      session_id: session.id,
      url: session.url,
      checkout_session: {
        id: session.id,
        url: session.url,
        status: session.status,
        mode: session.mode,
        created: session.created,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get checkout session status
router.get("/checkout-sessions/:id", validateStripe, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await stripe.checkout.sessions.retrieve(id);

    res.json({
      success: true,
      checkout_session: {
        id: session.id,
        status: session.status,
        mode: session.mode,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        customer: session.customer,
        subscription: session.subscription,
        created: session.created,
        expires_at: session.expires_at,
        metadata: session.metadata,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Handle Stripe webhook events
router.post(
  "/webhooks",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({
        success: false,
        error: "Webhook secret not configured",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({
        success: false,
        error: "Webhook signature verification failed",
      });
    }

    try {
      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("✅ Checkout session completed:", session.id);

          if (session.mode === "subscription") {
            console.log("📦 Subscription created:", session.subscription);
            console.log("👤 Customer:", session.customer_email);
            console.log("🏷️ Metadata:", session.metadata);

            // TODO: Add your database update logic here
            // Example: Update user subscription status in your database
            // await updateUserSubscription(session.metadata.userId, 'active', session.subscription);
          }
          break;
        }

        case "checkout.session.expired": {
          const expiredSession = event.data.object;
          console.log("⏰ Checkout session expired:", expiredSession.id);
          console.log("🏷️ Metadata:", expiredSession.metadata);

          // TODO: Add your database update logic here
          // Example: Mark subscription as incomplete
          // await updateUserSubscription(expiredSession.metadata.userId, 'incomplete');
          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object;
          console.log("🎉 Subscription created:", subscription.id);
          console.log("📊 Status:", subscription.status);
          console.log("🏷️ Metadata:", subscription.metadata);

          // TODO: Add your database update logic here
          // Example: Create subscription record in your database
          // await createSubscriptionRecord(subscription);
          break;
        }

        case "customer.subscription.updated": {
          const updatedSubscription = event.data.object;
          console.log("🔄 Subscription updated:", updatedSubscription.id);
          console.log("📊 New status:", updatedSubscription.status);
          console.log("🏷️ Metadata:", updatedSubscription.metadata);

          // TODO: Add your database update logic here
          // Example: Update subscription status in your database
          // await updateSubscriptionStatus(updatedSubscription.id, updatedSubscription.status);
          break;
        }

        case "customer.subscription.deleted": {
          const deletedSubscription = event.data.object;
          console.log("🗑️ Subscription deleted:", deletedSubscription.id);
          console.log("🏷️ Metadata:", deletedSubscription.metadata);

          // TODO: Add your database update logic here
          // Example: Mark subscription as cancelled in your database
          // await updateSubscriptionStatus(deletedSubscription.id, 'cancelled');
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          console.log("💰 Invoice payment succeeded:", invoice.id);
          console.log("👤 Customer:", invoice.customer);
          console.log("💵 Amount:", invoice.amount_paid);

          // TODO: Add your database update logic here
          // Example: Record successful payment in your database
          // await recordPayment(invoice);
          break;
        }

        case "invoice.payment_failed": {
          const failedInvoice = event.data.object;
          console.log("❌ Invoice payment failed:", failedInvoice.id);
          console.log("👤 Customer:", failedInvoice.customer);
          console.log("🏷️ Metadata:", failedInvoice.metadata);

          // TODO: Add your database update logic here
          // Example: Mark subscription as past_due in your database
          // await updateSubscriptionStatus(failedInvoice.subscription, 'past_due');
          break;
        }

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }

      res.json({ success: true, received: true });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      res.status(500).json({
        success: false,
        error: "Error processing webhook",
      });
    }
  }
);

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
