# Clubbix-Backend

A Node.js backend with Stripe SDK and Firebase integration for payment processing and subscription management.

## Features

- ✅ Express.js server with security middleware
- ✅ Stripe SDK integration with environment variables
- ✅ Firebase Admin SDK integration for Firestore
- ✅ Automatic subscription status updates in Firestore
- ✅ Health check endpoints with Stripe status
- ✅ Payment intent creation and management
- ✅ Subscription checkout sessions with trial periods
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

Copy the environment example file and configure your API keys:

```bash
cp env.example .env
```

Edit `.env` with your credentials:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Firebase Admin SDK (for Firestore integration)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="your_private_key_with_escaped_newlines"
# Or set GOOGLE_APPLICATION_CREDENTIALS to the path of your service account JSON file
```

### 3. Get Stripe API Keys

1. Sign up for a [Stripe account](https://stripe.com)
2. Go to the [Stripe Dashboard](https://dashboard.stripe.com)
3. Navigate to Developers → API keys
4. Copy your test keys (use live keys for production)

### 4. Set Up Firebase

#### Option A: Using Environment Variables (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Extract the following values and add them to your `.env`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and escape newlines)

#### Option B: Using Service Account JSON File

1. Download the service account JSON file from Firebase Console
2. Place it in your project (e.g., `service-account-key.json`)
3. Add to your `.env`:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
   ```

### 5. Configure Stripe Webhooks

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

### 6. Update Stripe Price IDs

Edit `src/routes/stripe.js` and replace the placeholder price IDs with your actual Stripe price IDs:

```javascript
const PRICE_IDS = {
  starter: {
    monthly: "price_1234567890", // Your actual price IDs
    annual: "price_0987654321",
  },
  pro: {
    monthly: "price_1111111111",
    annual: "price_2222222222",
  },
  elite: {
    monthly: "price_3333333333",
    annual: "price_4444444444",
  },
};
```

### 7. Run the Server

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
    "plan": "pro",
    "billingCycle": "monthly",
    "userId": "user123",
    "email": "customer@example.com",
    "clubId": "club456"
  }'
```

Response:

```json
{
  "success": true,
  "url": "https://checkout.stripe.com/pay/cs_1234567890",
  "sessionId": "cs_1234567890"
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
  "session": {
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
      "userId": "user123",
      "clubId": "club456",
      "plan": "pro",
      "billingCycle": "monthly"
    }
  }
}
```

## Firebase Integration

### Automatic Firestore Updates

The webhook handler automatically updates Firestore documents when Stripe events occur:

#### Supported Events and Firestore Updates:

- **`checkout.session.completed`** → Sets `subscriptionStatus: 'active'`
- **`checkout.session.expired`** → Sets `subscriptionStatus: 'incomplete'`
- **`customer.subscription.created`** → Sets `subscriptionStatus: 'active'`
- **`customer.subscription.updated`** → Updates `subscriptionStatus` to match Stripe status
- **`customer.subscription.deleted`** → Sets `subscriptionStatus: 'cancelled'`
- **`invoice.payment_failed`** → Sets `subscriptionStatus: 'past_due'`

#### Firestore Collections Updated:

The webhook handler updates these collections (customize as needed):

```javascript
// In src/routes/stripe.js - update these collection names
await db.collection("clubs").doc(clubId).update({
  subscriptionStatus: status,
  stripeSubscriptionId: subscriptionId,
  // ... other fields
});

await db.collection("users").doc(userId).update({
  subscriptionStatus: status,
  stripeSubscriptionId: subscriptionId,
  // ... other fields
});
```

#### Customizing Firestore Schema:

1. **Update Collection Names**: Change `'clubs'` and `'users'` to match your Firestore collections
2. **Add Custom Fields**: Modify the `updateSubscriptionStatus` function to include additional fields
3. **Handle Different Events**: Add custom logic for specific webhook events

Example customization:

```javascript
// Add custom fields based on your needs
await db.collection("clubs").doc(clubId).update({
  subscriptionStatus: status,
  stripeSubscriptionId: subscriptionId,
  lastPaymentDate: new Date(),
  planType: metadata.plan,
  billingCycle: metadata.billingCycle,
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
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

3. The webhook endpoint will automatically handle these events and update Firestore documents.

## Project Structure

```
Clubbix-Backend/
├── src/
│   ├── config/
│   │   ├── stripe.js          # Stripe SDK configuration
│   │   └── firebase.js        # Firebase Admin SDK configuration
│   ├── routes/
│   │   ├── health.js          # Health check endpoints
│   │   └── stripe.js          # Stripe API endpoints with Firestore integration
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

## Production Deployment

1. Set `NODE_ENV=production`
2. Use live Stripe keys (not test keys)
3. Configure proper CORS origins
4. Set up environment variables securely
5. Use a process manager like PM2
6. Ensure Firebase service account has proper permissions

## Troubleshooting

### Stripe Connection Issues

1. Verify your `STRIPE_SECRET_KEY` is correct
2. Check that you're using the right environment (test vs live)
3. Ensure your Stripe account is active

### Firebase Connection Issues

1. Verify your Firebase credentials are correct
2. Check that your service account has the necessary permissions
3. Ensure your Firebase project is active and billing is set up
4. Verify the collection names match your Firestore schema

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
- **"Missing required fields"** - Provide all required fields: plan, billingCycle, userId, email, clubId
- **"Invalid plan or billing cycle"** - Check that the plan and billing cycle match the PRICE_IDS configuration
- **"Firebase credentials are not set"** - Add Firebase credentials to `.env` or set `GOOGLE_APPLICATION_CREDENTIALS`
- **"Error updating Firestore"** - Check Firebase permissions and collection names

## License

MIT
