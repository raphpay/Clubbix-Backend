const express = require("express");
const router = express.Router();
const { stripe, validateStripeConfig } = require("../config/stripe");
const { db } = require("../config/firebase");
const { Timestamp } = require("firebase-admin").firestore;
const admin = require("firebase-admin");

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

    try {
      let firebaseData = {
        event_type: event.type,
        received_at: new Date().toISOString(),
        data: event.data.object,
      };

      // Helper to update club subscription data
      async function updateClubSubscription(clubId, data) {
        if (!clubId) return;
        await admin.firestore().collection("clubs").doc(clubId).set(
          {
            subscription: data,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const metadata = session.metadata || {};
          const clubId = metadata.clubId;
          if (session.mode === "subscription" && clubId) {
            // You may need to fetch the subscription for full details
            let subscription;
            if (session.subscription) {
              subscription = await stripe.subscriptions.retrieve(
                session.subscription
              );
            }
            const plan =
              metadata.plan ||
              subscription?.items?.data?.[0]?.price?.nickname ||
              "";
            const billingCycle =
              metadata.billingCycle ||
              subscription?.items?.data?.[0]?.price?.recurring?.interval ||
              "";
            const status = subscription?.status || "active";
            const currentPeriodStart = subscription?.current_period_start
              ? Timestamp.fromMillis(subscription.current_period_start * 1000)
              : Timestamp.now();
            const currentPeriodEnd = subscription?.current_period_end
              ? Timestamp.fromMillis(subscription.current_period_end * 1000)
              : Timestamp.now();
            const cancelAtPeriodEnd = !!subscription?.cancel_at_period_end;
            const createdAt = subscription?.created
              ? Timestamp.fromMillis(subscription.created * 1000)
              : Timestamp.now();
            const updatedAt = Timestamp.now();
            const clubSubscriptionData = {
              subscriptionId: subscription?.id,
              clubId,
              plan,
              billingCycle,
              status,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd,
              createdAt,
              updatedAt,
            };
            await updateClubSubscription(clubId, clubSubscriptionData);
          }
          firebaseData.session_id = session.id;
          firebaseData.mode = session.mode;
          firebaseData.customer_email = session.customer_email;
          firebaseData.customer_id = session.customer;
          firebaseData.metadata = session.metadata;
          firebaseData.payment_status = session.payment_status;
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          const metadata = subscription.metadata || {};
          const clubId = metadata.clubId;
          if (clubId) {
            const plan =
              metadata.plan ||
              subscription.items?.data?.[0]?.price?.nickname ||
              "";
            const billingCycle =
              metadata.billingCycle ||
              subscription.items?.data?.[0]?.price?.recurring?.interval ||
              "";
            const status = subscription.status;
            const currentPeriodStart = subscription.current_period_start
              ? Timestamp.fromMillis(subscription.current_period_start * 1000)
              : Timestamp.now();
            const currentPeriodEnd = subscription.current_period_end
              ? Timestamp.fromMillis(subscription.current_period_end * 1000)
              : Timestamp.now();
            const cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
            const createdAt = subscription.created
              ? Timestamp.fromMillis(subscription.created * 1000)
              : Timestamp.now();
            const updatedAt = Timestamp.now();
            const clubSubscriptionData = {
              subscriptionId: subscription.id,
              clubId,
              plan,
              billingCycle,
              status,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd,
              createdAt,
              updatedAt,
            };
            await updateClubSubscription(clubId, clubSubscriptionData);
          }
          firebaseData.subscription_id = subscription.id;
          firebaseData.customer_id = subscription.customer;
          firebaseData.status = subscription.status;
          firebaseData.metadata = subscription.metadata;
          break;
        }
        case "invoice.payment_succeeded":
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          firebaseData.invoice_id = invoice.id;
          firebaseData.subscription_id = invoice.subscription;
          firebaseData.customer_id = invoice.customer;
          firebaseData.amount = invoice.amount_paid || invoice.amount_due;
          firebaseData.currency = invoice.currency;
          firebaseData.status = invoice.status;
          break;
        }
        // Add more cases as needed
      }

      // Save to Firestore (collection: 'stripe_webhooks', doc: event.id)
      await admin
        .firestore()
        .collection("stripe_webhooks")
        .doc(event.id)
        .set(firebaseData);

      res.status(200).json({
        success: true,
        message: "Event received and saved to Firebase.",
      });
    } catch (error) {
      console.error("❌ Error processing webhook:", error);
      res.status(500).json({
        success: false,
        error: "Error processing webhook",
        message: error.message,
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
