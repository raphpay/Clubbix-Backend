const express = require("express");
const router = express.Router();
const { stripe, validateStripeConfig } = require("../config/stripe");
const { db } = require("../config/firebase");

// Price IDs mapping (replace with your actual Stripe price IDs)
const PRICE_IDS = {
  starter: {
    monthly: "starter_2606_monthly", // Replace with your actual price IDs
    annual: "starter_2606_yearly",
  },
  pro: {
    monthly: "pro_2606_monthly",
    annual: "pro_2606_yearly",
  },
  elite: {
    monthly: "elite_2606_monthly",
    annual: "elite_2606_yearly",
  },
};

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

// Create Stripe Checkout session for subscriptions (updated for frontend integration)
router.post("/checkout-sessions", validateStripe, async (req, res) => {
  try {
    const { plan, billingCycle, userId, email, clubId } = req.body;

    // Validate required fields
    if (!plan || !billingCycle || !userId || !email || !clubId) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: plan, billingCycle, userId, email, clubId",
      });
    }

    // Get the correct price ID based on plan and billing cycle
    const priceId = PRICE_IDS[plan]?.[billingCycle];
    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: "Invalid plan or billing cycle",
      });
    }

    // Create metadata for tracking
    const metadata = {
      userId,
      clubId,
      plan,
      billingCycle,
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14, // 14-day trial for all plans
        metadata: metadata,
      },
      success_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.FRONTEND_URL || "http://localhost:5173"
      }/cancel`,
      metadata: metadata,
    });

    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get checkout session status (updated for frontend integration)
router.get("/checkout-sessions/:id", validateStripe, async (req, res) => {
  try {
    const { id } = req.params;
    const session = await stripe.checkout.sessions.retrieve(id);

    res.json({
      success: true,
      session: {
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

// Handle Stripe webhook events (updated for subscription management)
router.post(
  "/webhook",
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

    // Helper: update Firestore club and user subscription status
    async function updateSubscriptionStatus({
      clubId,
      userId,
      status,
      subscriptionId,
      extra = {},
    }) {
      try {
        // TODO: Change 'clubs' and 'users' to your actual Firestore collection names
        if (clubId) {
          await db
            .collection("clubs")
            .doc(clubId)
            .update({
              subscriptionStatus: status,
              stripeSubscriptionId: subscriptionId,
              ...extra,
            });
        }
        if (userId) {
          await db
            .collection("users")
            .doc(userId)
            .update({
              subscriptionStatus: status,
              stripeSubscriptionId: subscriptionId,
              ...extra,
            });
        }
      } catch (err) {
        console.error("Error updating Firestore:", err);
      }
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("Checkout session completed:", session.id);
          if (session.mode === "subscription") {
            const { clubId, userId } = session.metadata || {};
            await updateSubscriptionStatus({
              clubId,
              userId,
              status: "active",
              subscriptionId: session.subscription,
            });
          }
          break;
        }
        case "checkout.session.expired": {
          const expiredSession = event.data.object;
          console.log("Checkout session expired:", expiredSession.id);
          const { clubId, userId } = expiredSession.metadata || {};
          await updateSubscriptionStatus({
            clubId,
            userId,
            status: "incomplete",
            subscriptionId: expiredSession.subscription,
          });
          break;
        }
        case "customer.subscription.created": {
          const subscription = event.data.object;
          console.log("Subscription created:", subscription.id);
          const { clubId, userId } = subscription.metadata || {};
          await updateSubscriptionStatus({
            clubId,
            userId,
            status: "active",
            subscriptionId: subscription.id,
          });
          break;
        }
        case "customer.subscription.updated": {
          const updatedSubscription = event.data.object;
          console.log("Subscription updated:", updatedSubscription.id);
          const { clubId, userId } = updatedSubscription.metadata || {};
          await updateSubscriptionStatus({
            clubId,
            userId,
            status: updatedSubscription.status,
            subscriptionId: updatedSubscription.id,
          });
          break;
        }
        case "customer.subscription.deleted": {
          const deletedSubscription = event.data.object;
          console.log("Subscription deleted:", deletedSubscription.id);
          const { clubId, userId } = deletedSubscription.metadata || {};
          await updateSubscriptionStatus({
            clubId,
            userId,
            status: "cancelled",
            subscriptionId: deletedSubscription.id,
          });
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          console.log("Invoice payment succeeded:", invoice.id);
          // Optionally update payment status in Firestore
          break;
        }
        case "invoice.payment_failed": {
          const failedInvoice = event.data.object;
          console.log("Invoice payment failed:", failedInvoice.id);
          const { clubId, userId } = failedInvoice.metadata || {};
          await updateSubscriptionStatus({
            clubId,
            userId,
            status: "past_due",
          });
          break;
        }
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      res.json({ success: true, received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
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
