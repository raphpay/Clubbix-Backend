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
      let responseData = {
        success: true,
        event_type: event.type,
        timestamp: new Date().toISOString(),
        data: null,
        message: "",
        action_required: null,
      };

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          console.log("✅ Checkout session completed:", session.id);

          if (session.mode === "subscription") {
            responseData.data = {
              session_id: session.id,
              subscription_id: session.subscription,
              customer_email: session.customer_email,
              customer_id: session.customer,
              metadata: session.metadata,
              payment_status: session.payment_status,
              status: "active",
            };
            responseData.message =
              "Subscription checkout completed successfully";
            responseData.action_required = {
              type: "update_subscription_status",
              status: "active",
              subscription_id: session.subscription,
              user_id: session.metadata?.userId,
              club_id: session.metadata?.clubId,
            };
          } else {
            responseData.data = {
              session_id: session.id,
              customer_email: session.customer_email,
              customer_id: session.customer,
              metadata: session.metadata,
              payment_status: session.payment_status,
            };
            responseData.message = "One-time payment completed successfully";
            responseData.action_required = {
              type: "update_payment_status",
              status: "completed",
              session_id: session.id,
            };
          }
          break;
        }

        case "checkout.session.expired": {
          const expiredSession = event.data.object;
          console.log("⏰ Checkout session expired:", expiredSession.id);

          responseData.data = {
            session_id: expiredSession.id,
            metadata: expiredSession.metadata,
            status: "expired",
          };
          responseData.message = "Checkout session expired";
          responseData.action_required = {
            type: "update_subscription_status",
            status: "incomplete",
            user_id: expiredSession.metadata?.userId,
            club_id: expiredSession.metadata?.clubId,
          };
          break;
        }

        case "customer.subscription.created": {
          const subscription = event.data.object;
          console.log("🎉 Subscription created:", subscription.id);

          responseData.data = {
            subscription_id: subscription.id,
            customer_id: subscription.customer,
            status: subscription.status,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            metadata: subscription.metadata,
          };
          responseData.message = "Subscription created successfully";
          responseData.action_required = {
            type: "create_subscription",
            subscription_id: subscription.id,
            status: subscription.status,
            user_id: subscription.metadata?.userId,
            club_id: subscription.metadata?.clubId,
          };
          break;
        }

        case "customer.subscription.updated": {
          const updatedSubscription = event.data.object;
          console.log("🔄 Subscription updated:", updatedSubscription.id);

          responseData.data = {
            subscription_id: updatedSubscription.id,
            customer_id: updatedSubscription.customer,
            status: updatedSubscription.status,
            current_period_start: updatedSubscription.current_period_start,
            current_period_end: updatedSubscription.current_period_end,
            metadata: updatedSubscription.metadata,
          };
          responseData.message = "Subscription updated";
          responseData.action_required = {
            type: "update_subscription",
            subscription_id: updatedSubscription.id,
            status: updatedSubscription.status,
            user_id: updatedSubscription.metadata?.userId,
            club_id: updatedSubscription.metadata?.clubId,
          };
          break;
        }

        case "customer.subscription.deleted": {
          const deletedSubscription = event.data.object;
          console.log("🗑️ Subscription deleted:", deletedSubscription.id);

          responseData.data = {
            subscription_id: deletedSubscription.id,
            customer_id: deletedSubscription.customer,
            status: "cancelled",
            metadata: deletedSubscription.metadata,
          };
          responseData.message = "Subscription cancelled";
          responseData.action_required = {
            type: "cancel_subscription",
            subscription_id: deletedSubscription.id,
            status: "cancelled",
            user_id: deletedSubscription.metadata?.userId,
            club_id: deletedSubscription.metadata?.clubId,
          };
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object;
          console.log("💰 Invoice payment succeeded:", invoice.id);

          responseData.data = {
            invoice_id: invoice.id,
            subscription_id: invoice.subscription,
            customer_id: invoice.customer,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            status: "paid",
          };
          responseData.message = "Payment succeeded";
          responseData.action_required = {
            type: "record_payment",
            invoice_id: invoice.id,
            subscription_id: invoice.subscription,
            amount: invoice.amount_paid,
            status: "paid",
          };
          break;
        }

        case "invoice.payment_failed": {
          const failedInvoice = event.data.object;
          console.log("❌ Invoice payment failed:", failedInvoice.id);

          responseData.data = {
            invoice_id: failedInvoice.id,
            subscription_id: failedInvoice.subscription,
            customer_id: failedInvoice.customer,
            amount_due: failedInvoice.amount_due,
            currency: failedInvoice.currency,
            status: "failed",
          };
          responseData.message = "Payment failed";
          responseData.action_required = {
            type: "update_subscription_status",
            subscription_id: failedInvoice.subscription,
            status: "past_due",
            invoice_id: failedInvoice.id,
          };
          break;
        }

        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
          responseData.message = `Unhandled event: ${event.type}`;
          responseData.data = event.data.object;
      }

      res.json(responseData);
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
