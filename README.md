# Clubbix-Backend

A Node.js backend with Stripe SDK integration for payment processing and subscription management.

## Features

- ✅ Express.js server with security middleware
- ✅ Stripe SDK integration with environment variables
- ✅ Health check endpoints with Stripe status
- ✅ Payment intent creation and management
- ✅ Subscription checkout sessions
- ✅ Webhook handling for subscription lifecycle events
- ✅ CORS enabled for frontend integration
- ✅ Comprehensive error handling
- ✅ Logging with Morgan
- ✅ Security headers with Helmet

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the environment example file and configure your Stripe keys:

```bash
cp env.example .env
```

Edit `.env` with your Stripe credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Optional: Webhook secret for Stripe webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

### 3. Get Stripe API Keys

1. Sign up for a [Stripe account](https://stripe.com)
2. Go to the [Stripe Dashboard](https://dashboard.stripe.com)
3. Navigate to Developers → API keys
4. Copy your test keys (use live keys for production)

### 4. Configure Stripe Webhooks (Optional but Recommended)

1. In your Stripe Dashboard, go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to your `.env`

### 5. Run the Server

**Development mode (with auto-restart):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Checks

- `GET /api/health` - Basic health check
- `GET /api/health/stripe` - Stripe-specific health check
- `GET /api/health/detailed` - Detailed system health

### Stripe Operations

- `GET /api/stripe/account` - Get Stripe account information
- `GET /api/stripe/publishable-key` - Get publishable key for frontend
- `POST /api/stripe/payment-intents` - Create a payment intent
- `GET /api/stripe/payment-intents/:id` - Get payment intent status
- `POST /api/stripe/checkout-sessions` - Create Stripe Checkout session for subscriptions
- `GET /api/stripe/checkout-sessions/:id` - Get checkout session status
- `POST /api/stripe/webhook` - Handle Stripe webhook events

## Usage Examples

### Health Check

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 123.45,
  "environment": "development"
}
```

### Stripe Health Check

```bash
curl http://localhost:3000/api/health/stripe
```

Response:

```json
{
  "status": "stripe_health_check",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "stripe": {
    "success": true,
    "accountId": "acct_1234567890",
    "message": "Stripe connection successful"
  },
  "environment": "development"
}
```

### Create Payment Intent

```bash
curl -X POST http://localhost:3000/api/stripe/payment-intents \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29.99,
    "currency": "usd",
    "description": "Premium subscription"
  }'
```

Response:

```json
{
  "success": true,
  "client_secret": "pi_1234567890_secret_abcdef",
  "payment_intent_id": "pi_1234567890"
}
```

### Create Checkout Session

```bash
curl -X POST http://localhost:3000/api/stripe/checkout-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "price_id": "price_1234567890",
    "success_url": "https://yourdomain.com/success",
    "cancel_url": "https://yourdomain.com/cancel",
    "customer_email": "customer@example.com",
    "mode": "subscription",
    "metadata": {
      "user_id": "123",
      "plan": "premium"
    }
  }'
```

Response:

```json
{
  "success": true,
  "session_id": "cs_1234567890",
  "url": "https://checkout.stripe.com/pay/cs_1234567890",
  "checkout_session": {
    "id": "cs_1234567890",
    "url": "https://checkout.stripe.com/pay/cs_1234567890",
    "status": "open",
    "mode": "subscription",
    "created": 1642234567
  }
}
```

### Get Checkout Session Status

```bash
curl http://localhost:3000/api/stripe/checkout-sessions/cs_1234567890
```

Response:

```json
{
  "success": true,
  "checkout_session": {
    "id": "cs_1234567890",
    "status": "complete",
    "mode": "subscription",
    "payment_status": "paid",
    "customer_email": "customer@example.com",
    "customer": "cus_1234567890",
    "subscription": "sub_1234567890",
    "created": 1642234567,
    "expires_at": 1642238167,
    "metadata": {
      "user_id": "123",
      "plan": "premium"
    }
  }
}
```

## Webhook Integration

### Frontend-Ready Event Handling

The webhook handler now returns structured responses that your frontend can use to update your database:

#### Response Format:

```json
{
  "success": true,
  "event_type": "checkout.session.completed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "session_id": "cs_1234567890",
    "subscription_id": "sub_1234567890",
    "customer_email": "customer@example.com",
    "customer_id": "cus_1234567890",
    "metadata": {
      "userId": "user123",
      "clubId": "club456"
    },
    "payment_status": "paid",
    "status": "active"
  },
  "message": "Subscription checkout completed successfully",
  "action_required": {
    "type": "update_subscription_status",
    "status": "active",
    "subscription_id": "sub_1234567890",
    "user_id": "user123",
    "club_id": "club456"
  }
}
```

#### Supported Events and Actions:

| Event                           | Action Type                  | Description                       |
| ------------------------------- | ---------------------------- | --------------------------------- |
| `checkout.session.completed`    | `update_subscription_status` | New subscription activated        |
| `checkout.session.expired`      | `update_subscription_status` | Checkout expired, mark incomplete |
| `customer.subscription.created` | `create_subscription`        | New subscription record needed    |
| `customer.subscription.updated` | `update_subscription`        | Subscription details changed      |
| `customer.subscription.deleted` | `cancel_subscription`        | Subscription cancelled            |
| `invoice.payment_succeeded`     | `record_payment`             | Payment successful                |
| `invoice.payment_failed`        | `update_subscription_status` | Payment failed, mark past_due     |

#### Frontend Integration Example:

```javascript
// In your frontend, listen for webhook responses
async function handleWebhookResponse(webhookData) {
  const { action_required, data, message } = webhookData;

  switch (action_required.type) {
    case "update_subscription_status":
      await updateUserSubscription(
        action_required.user_id,
        action_required.status,
        action_required.subscription_id
      );
      break;

    case "create_subscription":
      await createSubscriptionRecord({
        subscriptionId: action_required.subscription_id,
        userId: action_required.user_id,
        status: action_required.status,
        ...data,
      });
      break;

    case "cancel_subscription":
      await cancelUserSubscription(
        action_required.user_id,
        action_required.subscription_id
      );
      break;

    case "record_payment":
      await recordPayment({
        invoiceId: data.invoice_id,
        subscriptionId: data.subscription_id,
        amount: action_required.amount,
        status: action_required.status,
      });
      break;
  }

  // Show user notification
  showNotification(message, "success");
}

// Example database update functions
async function updateUserSubscription(userId, status, subscriptionId) {
  // Update your database here
  await fetch("/api/users/subscription", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      subscriptionStatus: status,
      stripeSubscriptionId: subscriptionId,
    }),
  });
}

async function createSubscriptionRecord(subscriptionData) {
  // Create subscription record in your database
  await fetch("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscriptionData),
  });
}
```

### Webhook Setup

To handle Stripe webhooks, you'll need to:

1. Add your webhook secret to `.env`:

   ```env
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

2. Configure your webhook endpoint in Stripe Dashboard:

   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `checkout.session.expired`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

3. The webhook endpoint will return structured responses that your frontend can use to update your database.

## Project Structure

```
Clubbix-Backend/
├── src/
│   ├── config/
│   │   └── stripe.js          # Stripe SDK configuration
│   ├── routes/
│   │   ├── health.js          # Health check endpoints
│   │   └── stripe.js          # Stripe API endpoints with webhook handling
│   └── server.js              # Main server file
├── .env                       # Environment variables (create from env.example)
├── .gitignore                 # Git ignore rules
├── env.example                # Environment variables template
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Development

### Available Scripts

- `npm start` - Start the server in production mode
- `npm run dev` - Start the server in development mode with auto-restart
- `npm test` - Run tests (when implemented)

### Adding New Features

1. Create new route files in `src/routes/`
2. Import and use them in `src/server.js`
3. Follow the existing pattern for error handling and validation

## Security

- Environment variables for sensitive data
- Helmet.js for security headers
- CORS configuration
- Input validation
- Error handling without exposing internals
- Webhook signature verification

## Production Deployment

1. Set `NODE_ENV=production`
2. Use live Stripe keys (not test keys)
3. Configure proper CORS origins
4. Set up environment variables securely
5. Use a process manager like PM2
6. Ensure your webhook endpoint is publicly accessible

## Troubleshooting

### Stripe Connection Issues

1. Verify your `STRIPE_SECRET_KEY` is correct
2. Check that you're using the right environment (test vs live)
3. Ensure your Stripe account is active

### Webhook Issues

1. Verify your `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure your webhook endpoint is publicly accessible
3. Check that the webhook URL in Stripe Dashboard matches your endpoint
4. Verify the webhook events are properly configured in Stripe Dashboard

### Common Errors

- **"STRIPE_SECRET_KEY is required"** - Add your Stripe secret key to `.env`
- **"Stripe connection failed"** - Check your internet connection and Stripe API status
- **"Publishable key not configured"** - Add `STRIPE_PUBLISHABLE_KEY` to `.env`
- **"Webhook secret not configured"** - Add `STRIPE_WEBHOOK_SECRET` to `.env`
- **"Webhook signature verification failed"** - Check your webhook secret and endpoint configuration
- **"Price ID is required for subscription checkout"** - Provide a valid Stripe price ID when creating checkout sessions
- **"Success URL and Cancel URL are required"** - Provide both URLs when creating checkout sessions

## License

MIT
