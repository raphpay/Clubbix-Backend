# Clubbix-Backend

A Node.js backend with Stripe SDK integration for payment processing.

## Features

- ✅ Express.js server with security middleware
- ✅ Stripe SDK integration with environment variables
- ✅ Health check endpoints with Stripe status
- ✅ Payment intent creation and management
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
```

### 3. Get Stripe API Keys

1. Sign up for a [Stripe account](https://stripe.com)
2. Go to the [Stripe Dashboard](https://dashboard.stripe.com)
3. Navigate to Developers → API keys
4. Copy your test keys (use live keys for production)

### 4. Run the Server

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

## Project Structure

```
Clubbix-Backend/
├── src/
│   ├── config/
│   │   └── stripe.js          # Stripe SDK configuration
│   ├── routes/
│   │   ├── health.js          # Health check endpoints
│   │   └── stripe.js          # Stripe API endpoints
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

## Troubleshooting

### Stripe Connection Issues

1. Verify your `STRIPE_SECRET_KEY` is correct
2. Check that you're using the right environment (test vs live)
3. Ensure your Stripe account is active

### Common Errors

- **"STRIPE_SECRET_KEY is required"** - Add your Stripe secret key to `.env`
- **"Stripe connection failed"** - Check your internet connection and Stripe API status
- **"Publishable key not configured"** - Add `STRIPE_PUBLISHABLE_KEY` to `.env`

## License

MIT
