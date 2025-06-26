const stripe = require("stripe");

// Initialize Stripe with secret key from environment variables
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

// Validate that Stripe is properly configured
const validateStripeConfig = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is required in environment variables");
  }

  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    console.warn("STRIPE_PUBLISHABLE_KEY not found in environment variables");
  }

  return true;
};

// Test Stripe connection
const testStripeConnection = async () => {
  try {
    // Make a simple API call to test the connection
    const account = await stripeInstance.accounts.retrieve();
    return {
      success: true,
      accountId: account.id,
      message: "Stripe connection successful",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: "Stripe connection failed",
    };
  }
};

module.exports = {
  stripe: stripeInstance,
  validateStripeConfig,
  testStripeConnection,
};
