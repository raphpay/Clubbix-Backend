const express = require("express");
const router = express.Router();
const {
  validateStripeConfig,
  testStripeConnection,
} = require("../config/stripe");

// Basic health check
router.get("/", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Stripe health check
router.get("/stripe", async (req, res) => {
  try {
    // Validate Stripe configuration
    validateStripeConfig();

    // Test Stripe connection
    const stripeStatus = await testStripeConnection();

    res.json({
      status: "stripe_health_check",
      timestamp: new Date().toISOString(),
      stripe: stripeStatus,
      environment: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    res.status(500).json({
      status: "stripe_health_check_failed",
      timestamp: new Date().toISOString(),
      error: error.message,
      stripe: {
        success: false,
        error: error.message,
      },
    });
  }
});

// Detailed health check
router.get("/detailed", async (req, res) => {
  try {
    // Validate Stripe configuration
    validateStripeConfig();

    // Test Stripe connection
    const stripeStatus = await testStripeConnection();

    res.json({
      status: "detailed_health_check",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "development",
      stripe: stripeStatus,
      services: {
        stripe: stripeStatus.success ? "operational" : "failed",
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "detailed_health_check_failed",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        stripe: "failed",
      },
    });
  }
});

module.exports = router;
