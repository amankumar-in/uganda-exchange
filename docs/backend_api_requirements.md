# Backend API Requirements - UG Coin

## Project Overview
**UG Coin** is a cryptocurrency exchange platform with fiat on/off ramps. The frontend is built with Next.js 13 and TypeScript, and requires a comprehensive backend API to handle:
- User authentication & KYC
- Fiat deposits/withdrawals (Stripe integration)
- Crypto deposits/withdrawals (Binance API integration)
- Trading (Buy/Sell/Swap via Binance)
- Wallet management
- Admin dashboard

---

## Frontend Pages Inventory

### **Authentication & Onboarding** (6 pages)
- `/login` - User login
- `/register` - User registration with email/phone OTP
- `/reset` - Password reset flow
- `/onboarding` - Multi-step KYC process (5 steps)
  - Step 0: Personal details
  - Step 1: Address
  - Step 2: User agreement
  - Step 3: Document upload (Socure integration)
  - Step 4: Status check

### **Trading** (4 pages)
- `/exchange/[pair]` - Spot trading (e.g., BTC-USD)
- `/exchange/history` - Trade history
- `/p2p/[pair]` - P2P trading
- `/p2p/order/[orderId]` - P2P order details

### **Fiat Operations** (7 pages)
- `/fiat/deposit` - Deposit options (wire/credit card)
- `/fiat/deposit/wire` - Wire transfer instructions
- `/fiat/deposit/credit-card` - Credit card deposit
- `/fiat/deposit/credit-card/add` - Add new card
- `/fiat/deposit/credit-card/verify` - Verify card deposit
- `/fiat/withdraw` - Fiat withdrawal
- `/fiat/withdraw/add-bank` - Add bank account
- `/fiat/history` - Fiat transaction history

### **Wallet & Assets** (6 pages)
- `/wallet` - Main wallet overview
- `/wallet/transactions` - Transaction history (fiat + crypto)
- `/wallet/transfers` - Transfer history (deposits/withdrawals)
- Crypto deposit modal
- Crypto withdrawal modal
- Add withdrawal address modal

### **Settings** (5 pages)
- `/settings/profile` - Profile overview
- `/settings/profile/email` - Update email
- `/settings/profile/phone` - Update phone
- `/settings/security` - Security overview
- `/settings/security/change-password` - Change password
- `/settings/fees` - Fee schedule

### **Static Pages** (4 pages)
- `/terms-of-use`
- `/privacy-policy`
- `/anti-fraud-policy`
- `/bsa-policy`
- `/complaint-management`

---

## Complete API Endpoint Mapping

### **1. Authentication & Account Management**

#### Public Endpoints (No Auth Required)
```
POST   /api/account/create          - Register new user
POST   /api/account/login           - Login user
POST   /api/account/logout          - Logout user
POST   /api/account/reset           - Initiate password reset
POST   /api/account/reset/verify    - Verify reset OTP
POST   /api/account/reset/new-password - Set new password
```

**Request/Response Examples:**

**Register:**
```json
POST /api/account/create
{
  "email": "user@example.com",
  "phone": "1234567890",
  "phoneCountry": "1",
  "password": "SecurePass123!",
  "country": "US",
  "agreement": true,
  "patriotAct": true
}
Response: { "message": "OTP sent to email and phone" }

// Then verify with OTPs:
{
  "email": "user@example.com",
  "phone": "1234567890",
  "phoneCountry": "1",
  "password": "SecurePass123!",
  "otpEmail": "123456",
  "otpPhone": "654321",
  "country": "US"
}
Response: { "message": "Account created successfully" }
```

**Login:**
```json
POST /api/account/login
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "remember": true
}
Response: {
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": { /* user info */ }
}
```

#### Protected Endpoints (Require Auth)
```
GET    /api/account/me              - Get current user info
PUT    /api/account/update/email    - Update email (sends OTP)
POST   /api/account/update/email/verify-new-email - Verify new email
POST   /api/account/update/email/verify-current-email - Verify current email
PUT    /api/account/update/phone    - Update phone (sends OTP)
POST   /api/account/update/phone/verify-new-phone - Verify new phone
POST   /api/account/update/phone/verify-current-phone - Verify current phone
PUT    /api/account/update/password - Update password (sends OTP)
POST   /api/account/update/password/verify - Verify password change
```

---

### **2. OTP Management**

```
POST   /otp/resend/email            - Resend email OTP
POST   /otp/resend/phone            - Resend phone OTP
```

**Request:**
```json
POST /otp/resend/email
{
  "email": "user@example.com",
  "type": "REGISTER" | "RESET" | "UPDATE_EMAIL"
}

POST /otp/resend/phone
{
  "phone": "1234567890",
  "phoneCountry": "1",
  "type": "REGISTER" | "UPDATE_PHONE"
}
```

---

### **3. KYC / Onboarding**

```
GET    /api/onboarding/status       - Get onboarding status
POST   /api/onboarding/agreement-preview - Preview user agreement
POST   /api/onboarding/finish       - Submit KYC application
POST   /api/onboarding/restart      - Restart KYC process
POST   /api/onboarding/socure       - Submit Socure document verification
```

**Onboarding Form Data:**
```json
POST /api/onboarding/finish
{
  "firstName": "John",
  "middleName": "M",
  "lastName": "Doe",
  "sex": "male",
  "birthday": {
    "day": "15",
    "month": "06",
    "year": "1990"
  },
  "address": {
    "street1": "123 Main St",
    "street2": "Apt 4B",
    "city": "New York",
    "region": "NY",
    "postalCode": "10001",
    "country": "US"
  },
  "taxCountry": "US",
  "taxId": "123-45-6789",
  "socureDeviceId": "device_id_from_socure",
  "socureDocumentId": "document_id_from_socure"
}

Response: { "message": "KYC submitted successfully" }
```

**Status Response:**
```json
GET /api/onboarding/status
Response: {
  "total": 5,
  "success": 0,
  "pending": 5,
  "rejected": 0,
  "errors": []
}
```

---

### **4. Fiat Operations**

#### Fiat Balances & Transactions
```
GET    /api/fiat/totals             - Get fiat balance summary
GET    /api/fiat/transactions       - Get fiat transaction history
```

#### Wire Transfers
```
GET    /api/fiat/wire/instructions  - Get wire transfer instructions
```

**Response:**
```json
{
  "bankName": "Prime Trust Bank",
  "accountNumber": "1234567890",
  "routingNumber": "987654321",
  "accountName": "UG Coin - User #12345",
  "reference": "USER12345"
}
```

#### Credit Card Operations (Stripe Integration)
```
GET    /api/fiat/credit-cards       - List saved credit cards
POST   /api/fiat/credit-cards       - Add new credit card (returns Stripe token)
POST   /api/fiat/credit-cards/deposit - Initiate card deposit
DELETE /api/fiat/credit-cards/:id   - Remove credit card
```

**Add Card:**
```json
POST /api/fiat/credit-cards
Response: {
  "token": "stripe_setup_intent_token"
}
// Frontend uses this token with Stripe.js to collect card details
```

**Deposit with Card:**
```json
POST /api/fiat/credit-cards/deposit
{
  "card": "card_id_from_stripe",
  "amount": 1000.00
}
Response: {
  "token": "verification_token"
}
// Redirect to /fiat/deposit/credit-card/verify?token=xxx
```

#### Bank Account Operations
```
GET    /api/fiat/bank-accounts      - List saved bank accounts
POST   /api/fiat/bank-accounts      - Add new bank account
DELETE /api/fiat/bank-accounts/:id  - Remove bank account
```

**Add Bank Account:**
```json
POST /api/fiat/bank-accounts
{
  "accountNumber": "1234567890",
  "routingNumber": "987654321",
  "accountType": "checking" | "savings",
  "accountName": "John Doe"
}
```

#### Fiat Withdrawals
```
POST   /api/fiat/withdraw           - Initiate fiat withdrawal
```

**Request:**
```json
POST /api/fiat/withdraw
{
  "bankAccountId": "bank_account_id",
  "amount": 500.00
}
```

---

### **5. Crypto Assets**

#### Asset Balances
```
GET    /api/assets                  - Get all crypto balances
GET    /balances                    - Get all balances (fiat + crypto)
```

**Response:**
```json
GET /api/assets
[
  { "code": "BTC", "unit": 0.5, "usdValue": 25000 },
  { "code": "ETH", "unit": 10.0, "usdValue": 20000 }
]

GET /balances
[
  { "code": "USD", "unit": 10000 },
  { "code": "BTC", "unit": 0.5 },
  { "code": "ETH", "unit": 10.0 }
]
```

#### Crypto Deposits
```
GET    /api/assets/wallet-address   - Get deposit address for asset
```

**Request:**
```
GET /api/assets/wallet-address?asset=BTC
Response: {
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "network": "Bitcoin",
  "memo": null
}
```

#### Crypto Withdrawals
```
GET    /api/assets/withdraw/addresses - List saved withdrawal addresses
POST   /api/assets/withdraw/addresses - Add new withdrawal address
DELETE /api/assets/withdraw/addresses/:id - Remove withdrawal address
POST   /api/assets/withdraw          - Initiate crypto withdrawal
```

**Add Withdrawal Address:**
```json
POST /api/assets/withdraw/addresses
{
  "asset": "BTC",
  "address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "label": "My Ledger Wallet",
  "network": "Bitcoin"
}
```

**Withdraw Crypto:**
```json
POST /api/assets/withdraw
{
  "asset": "BTC",
  "assetTransferMethodId": "withdrawal_address_id",
  "unitCount": 0.1
}
```

#### Asset Transactions
```
GET    /api/assets/transactions     - Get crypto transaction history
```

---

### **6. Trading**

#### Spot Trading (Exchange)
```
POST   /trade                       - Execute spot trade (buy/sell)
```

**Request:**
```json
POST /trade
{
  "asset": "BTC",
  "base": "USD",
  "unit": 0.1,
  "orderType": "BUY" | "SELL"
}
Response: { "message": "Order executed" }
```

#### P2P Trading
```
POST   /p2p-order                   - Create P2P order
GET    /p2p-order/:orderId          - Get P2P order details
DELETE /p2p-order/:orderId          - Cancel P2P order
```

**Create P2P Order:**
```json
POST /p2p-order
{
  "asset": "BTC",
  "base": "USD",
  "quantity": 0.5,
  "price": 50000,
  "orderType": "BUY" | "SELL"
}
```

---

### **7. Transfers & Transaction History**

```
GET    /api/transfers/fiat          - Fiat transfer history (paginated)
POST   /api/transfers/fiat/:id/retry - Retry failed fiat transfer
POST   /api/transfers/fiat/:id/cancel - Cancel pending fiat transfer

GET    /api/transfers/asset         - Crypto transfer history (paginated)
POST   /api/transfers/asset/:id/retry - Retry failed crypto transfer
POST   /api/transfers/asset/:id/cancel - Cancel pending crypto transfer

GET    /api/transactions/fiat       - Fiat transaction history (paginated)
GET    /api/transactions/asset      - Crypto transaction history (paginated)
```

**Pagination:**
```
GET /api/transfers/fiat?page=1&limit=20
Response: {
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

### **8. Market Data**

```
GET    /tuit                        - Get TUIT coin counter (example)
```

**Note:** You'll need WebSocket connections for real-time market data:
- Trading pairs prices
- Order book updates
- Recent trades

---

## Technology Stack Recommendations

### **Backend Framework**
- **Node.js + Express** (matches frontend TypeScript ecosystem)
- **NestJS** (enterprise-grade, TypeScript-native, better structure)
- **Python + FastAPI** (if you prefer Python)

### **Database**
- **PostgreSQL** - Main database (users, transactions, orders)
- **Redis** - Caching, session management, rate limiting
- **MongoDB** (optional) - For logs, analytics

### **Third-Party Integrations**

#### **1. KYC/Identity Verification**
- **Socure** (already integrated in frontend)
  - Document verification
  - Identity verification
  - Device fingerprinting

#### **2. Payment Processing**
- **Stripe** (for credit/debit cards)
  - Payment Intents API
  - Setup Intents (for saving cards)
  - Webhooks for payment status
- **Wire Transfers** - Manual processing or use **Prime Trust** / **Plaid**

#### **3. Crypto Operations**
- **Binance API** (for trading)
  - Spot trading
  - Market data
  - Price feeds
- **Blockchain Node** or **Third-party API** (for deposits/withdrawals)
  - **Alchemy** / **Infura** (Ethereum)
  - **BlockCypher** (Bitcoin)
  - **Tatum** (Multi-chain)

#### **4. Notifications**
- **Twilio** - SMS OTP
- **SendGrid** / **AWS SES** - Email OTP and notifications

#### **5. Security**
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **2FA** - TOTP (optional, not in current frontend)

---

## Database Schema Overview

### **Users Table**
```sql
users:
  - id (UUID)
  - email (unique)
  - phone (unique)
  - phoneCountry
  - passwordHash
  - country
  - createdAt
  - updatedAt
  - emailVerified
  - phoneVerified
  - kycStatus (pending, approved, rejected)
```

### **KYC Table**
```sql
kyc_applications:
  - id
  - userId (FK)
  - firstName
  - middleName
  - lastName
  - sex
  - birthday
  - address (JSON)
  - taxCountry
  - taxId
  - socureDeviceId
  - socureDocumentId
  - status
  - errors (JSON)
  - createdAt
  - updatedAt
```

### **Fiat Accounts**
```sql
fiat_balances:
  - id
  - userId (FK)
  - currency (USD)
  - balance (DECIMAL)
  - availableBalance (DECIMAL)
  - lockedBalance (DECIMAL)

bank_accounts:
  - id
  - userId (FK)
  - accountNumber (encrypted)
  - routingNumber (encrypted)
  - accountType
  - accountName
  - isVerified

credit_cards:
  - id
  - userId (FK)
  - stripeCardId
  - last4
  - brand
  - expiryMonth
  - expiryYear
```

### **Crypto Assets**
```sql
crypto_balances:
  - id
  - userId (FK)
  - asset (BTC, ETH, etc.)
  - balance (DECIMAL)
  - availableBalance
  - lockedBalance

deposit_addresses:
  - id
  - userId (FK)
  - asset
  - address
  - network
  - memo

withdrawal_addresses:
  - id
  - userId (FK)
  - asset
  - address
  - label
  - network
  - isWhitelisted
```

### **Transactions**
```sql
fiat_transactions:
  - id
  - userId (FK)
  - type (deposit, withdrawal)
  - method (wire, card)
  - amount
  - status (pending, completed, failed)
  - reference
  - createdAt

crypto_transactions:
  - id
  - userId (FK)
  - asset
  - type (deposit, withdrawal)
  - amount
  - address
  - txHash
  - status
  - confirmations
  - createdAt

trades:
  - id
  - userId (FK)
  - asset
  - base
  - orderType (buy, sell)
  - quantity
  - price
  - fee
  - status
  - createdAt
```

### **P2P Orders**
```sql
p2p_orders:
  - id
  - userId (FK)
  - asset
  - base
  - quantity
  - quantityRemaining
  - price
  - averagePrice
  - totalPrice
  - orderType
  - status
  - createdAt

p2p_transactions:
  - id
  - orderId (FK)
  - buyerId (FK)
  - sellerId (FK)
  - quantity
  - price
  - status
  - createdAt
```

---

## Key Features to Implement

### **1. Authentication & Security**
- ✅ JWT-based authentication
- ✅ Email/Phone OTP verification
- ✅ Password reset flow
- ✅ Rate limiting on sensitive endpoints
- ✅ IP whitelisting (optional)
- ⚠️ 2FA (not in current frontend, but recommended)

### **2. KYC/AML Compliance**
- ✅ Multi-step onboarding
- ✅ Socure integration for document verification
- ✅ Manual review workflow for admin
- ✅ Risk scoring
- ✅ Transaction monitoring

### **3. Fiat Operations**
- ✅ Stripe integration for card payments
- ✅ Wire transfer tracking
- ✅ Bank account verification (micro-deposits or Plaid)
- ✅ Withdrawal limits and compliance checks

### **4. Crypto Operations**
- ✅ Unique deposit addresses per user
- ✅ Blockchain monitoring for deposits
- ✅ Withdrawal address whitelisting
- ✅ Multi-signature wallets (recommended)
- ✅ Hot/Cold wallet management

### **5. Trading Engine**
- ✅ Integration with Binance API
- ✅ Order execution
- ✅ Fee calculation (0.5% platform + 0.5% maker)
- ✅ P2P order matching
- ✅ Trade history

### **6. Admin Dashboard**
- User management
- KYC review and approval
- Transaction monitoring
- Withdrawal approvals
- System health monitoring

---

## Environment Variables Needed

```env
# Server
NODE_ENV=development
PORT=8000
API_URL=http://localhost:8000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/intuition_exchange
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRY=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Binance
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_TESTNET=true

# Socure
SOCURE_API_KEY=your_socure_api_key
SOCURE_SDK_KEY=your_socure_sdk_key

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@ugcoin.com

# Blockchain APIs
ALCHEMY_API_KEY=your_alchemy_key
BLOCKCYPHER_TOKEN=your_blockcypher_token

# Security
ENCRYPTION_KEY=your_encryption_key_for_sensitive_data
```

---

## Next Steps

1. **Choose Backend Framework** - NestJS recommended for TypeScript consistency
2. **Set up Database** - PostgreSQL + Redis
3. **Implement Core Auth** - JWT, OTP, password management
4. **Integrate Stripe** - Card payments
5. **Integrate Binance** - Trading functionality
6. **Set up Blockchain Monitoring** - Deposit/withdrawal tracking
7. **Build Admin Dashboard** - User/KYC management
8. **Testing & Security Audit**
9. **Deploy to Production**

---

## Questions for Clarification

1. **Binance Integration**: Do you have a Binance account? Will you use Binance Spot API or do you want to build your own order matching engine?

2. **Custody Solution**: For crypto assets, will you:
   - Use a third-party custody solution (Fireblocks, BitGo)?
   - Build your own hot/cold wallet system?
   - Use Binance custody?

3. **Compliance**: What jurisdictions will you operate in? This affects:
   - KYC requirements
   - AML monitoring
   - Licensing needs

4. **Admin Features**: What specific admin capabilities do you need beyond basic user/transaction management?

5. **Fiat Withdrawals**: For wire transfers, will you:
   - Process manually?
   - Use an automated system (Prime Trust, Plaid)?

6. **P2P Trading**: Should P2P orders be:
   - Fully automated matching?
   - Escrow-based?
   - What's the settlement process?

Let me know which areas you'd like me to explain in more detail!


joshua binance US API
API Key:
aPi71dhUk6elsImco3di3MFJGbT6G7oU07ZIY9gaa0X5pkFJsSp9pza6WnjpFTuv
Secret Key:
OULD41sDPhXQsN6WrqcliBtVG8tozAIKXGYjjmrgmOUZ6d5j3H7T9RUqD0VnNCgs


Coinbase
api key - 3c431cf1-aa93-428b-a968-0a052bbf5fa3
secret - FQhdbWe6C/zBrt7M5BGzK+zOojYMfgSoW+83nVWLTjpF5GY28yfXS41Apf7ilimTQqIhk/KeUxezuafehn2/Ww==

joshua coinbase
api - ff105607-0d67-47ab-9f62-3e0f72b2d531
secret - uRKgALuj4mRZUJcwM/mAXqOEdzq/7PNe5obG5Q9Zo8VtonEqVVq6ccG3pfjG1/F8H9YUhdhlgA/xEUe1/2OtVg==

test
npx ts-node test-coinbase.ts