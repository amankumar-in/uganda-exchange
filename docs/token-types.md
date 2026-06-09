# Token Types & Price Discovery

There are 4 types of tokens in UG CoinExchange. Each has different price discovery, trading, and display logic.

---

## 1. Coinbase Tokens (BTC, ETH, SOL, DOGE, etc.)

**Database**: `tokens` table with `isNative = false`, `isCollegeCoin = false`
**Count**: ~266 tokens (auto-synced from Coinbase)

### Price Discovery
- **Primary**: Coinbase Advanced API via `getProducts()` in `coinbase.service.ts`
- **Real-time**: WebSocket price updates via `price-cache.service.ts` (3s refresh)
- **Frontend**: `ExchangeContext.tsx` fetches from `/api/coinbase/products`, gets price/volume/24h change
- **Fallback for individual lookup**: `tokens.service.ts` → `coingeckoId` → `contractAddress` → `manualPrice`
- Most tokens have `manualPrice = 0` and no `coingeckoId` (not needed since Coinbase provides prices)

### Trading
- **Investor mode**: Real orders via Coinbase Advanced API (`orders.service.ts`)
- **Learner mode**: Simulated trades using Coinbase prices (`learner.service.ts`)
- Trade pairs generated from Coinbase products (USD, USDT, ETH quotes)
- Synthetic cross-pairs auto-generated (e.g., if X-USD and ETH-USD exist → X-ETH pair created)

### Permissions
- Stored in `tokens` table: `allowBuy`, `allowSell`, `allowTradeUsd`, `allowTradeUsdt`, `allowTradeEth`, `allowP2P`, etc.
- Defaults from `global_asset_settings` table (singleton row)
- New Coinbase tokens auto-created via `syncCoinbaseTokens()` with global defaults
- Applied to pairs in `ExchangeContext.tsx` step 4 (lines 352-368)

### Display
- **Markets page**: Shows as USD pairs from Coinbase, filtered in `ExchangeContext` → `pairs`
- **Trade page**: Listed in pair selector
- **Portfolio**: Value = balance × pair price (looked up from `pairs` array)

---

## 2. College Coins (real, on-chain tokens for colleges)

**Database**: `tokens` table with `isCollegeCoin = true`
**Examples**: STAN (Stanford), AA (Art22 Academy), WC21, etc.

### Price Discovery
- `manualPrice` field in `tokens` table (most are 0)
- Optional: `coingeckoId` or `contractAddress + chain` for live pricing
- `tokens.service.ts` → `findBySymbol()` tries contract → coingeckoId → manualPrice fallback

### Trading
- Have `allowTradeUsd = true` by default (from global settings)
- Mining supported: `miningAllowed`, `miningBaseRate`, `miningSessionHours`
- Mining via `mining.service.ts` → users earn tokens over time
- CFC bridge integration for migrating from CoinsForCollege platform

### Permissions
- Same permission fields as Coinbase tokens in `tokens` table
- Mining-specific: `miningAllowed`, `miningBaseRate`, `miningSessionHours`

### Display
- These do NOT automatically appear on markets/trade pages unless they have a Coinbase listing or `isNative = true`
- Mining balances shown on portfolio page in a separate "College Coins" section
- Dedicated `/college-coins/[symbol]` pages

---

## 3. Demo College Coins (virtual, learner-mode only)

**Database**: `demo_college_coins` table (separate from `tokens`)
**Purpose**: Practice trading with virtual college coins in Learner mode

### Price Discovery
- Pegged to a real crypto asset at a percentage
- Price = `referenceCryptoPrice × (peggedPercentage / 100)`
- Reference prices from Coinbase (e.g., pegged to BTC at 0.1%)
- Calculated in `demo-college-coins.service.ts`

### Trading
- Learner mode only — uses virtual balances (`learner_crypto_balances`)
- Trades via `learner.service.ts`

### Permissions
- Managed per-coin in `demo_college_coins` table
- Not subject to `tokens` table permissions

### Display
- **Markets page**: Shown under "Colleges" filter tab (`isDemoCollegeCoin = true` pairs)
- **Trade page**: Selectable in pair selector
- Generated in `ExchangeContext.tsx` step 3 (line 342) from `getDemoCollegeCoins()` API

---

## 4. Native Platform Tokens (TUIT)

**Database**: `tokens` table with `isNative = true`
**Currently**: Only TUIT (Tuition Coin)

### Price Discovery
- `manualPrice` in `tokens` table (TUIT = $0.005)
- Optional: `coingeckoId` or `contractAddress + chain` for live pricing
- `tokens.service.ts` → same resolution chain as college coins
- In `ExchangeContext.tsx`, price = `token.currentPrice || token.manualPrice || 0`

### Trading
- Custom pairs built in `ExchangeContext.tsx` step 5 (line 371)
- **Only included if `isNative = true` AND `isActive = true`**
- Generates pairs based on `allowTradeUsd`, `allowTradeUsdt`, `allowTradeEth` flags
- TUIT also has `allowTradeTuit` flag for TUIT-quoted pairs (other tokens traded against TUIT)

### Permissions
- Same permission fields as other tokens
- TUIT-specific: `tuit_authorized_wallets`, `tuit_transfers`, `tuit_conversion_requests` tables
- Vesting contract integration via `tuit-transfer` module

### Display
- Appears on markets/trade/portfolio **only if `isNative = true`**
- Portfolio page has TUIT as a "required asset" (always shown)
- Portfolio value = balance × price from `TUIT-USD` pair (which requires `isNative = true`)

---

## Key Code Paths

### ExchangeContext.tsx - Pair Building
1. Fetch Coinbase products → `coinbasePairs`
2. Generate synthetic cross-pairs → `syntheticPairs`
3. Fetch demo college coins → `collegePairs`
4. Apply permissions from `tokens` table to Coinbase/synthetic pairs
5. Build custom pairs for `isNative = true` tokens → `customPairs`
6. Merge and deduplicate by symbol

### tokens.service.ts - Price Resolution
- `findBySymbol()`: contractAddress → coingeckoId → manualPrice
- `fetchPrices()`: Batch pricing for all tokens (same priority)

### Portfolio Value Calculation (portfolio/index.tsx)
- Looks up `pairs.find(p => p.baseCurrency === asset && p.quote === 'USD')`
- `usdValue = balance × price`
- If no pair found → price = 0 → value shows as $0.00

---

## Database Tables by Token Type

| Table | Purpose |
|-------|---------|
| `tokens` | All token configs (Coinbase, college, native) with permissions |
| `demo_college_coins` | Virtual college coins for learner mode |
| `global_asset_settings` | Default permissions for new tokens (singleton) |
| `crypto_balances` | User balances (investor mode) |
| `learner_crypto_balances` | User balances (learner mode) |
| `trading_pairs` | Currently empty — pairs are generated dynamically |
| `tuit_authorized_wallets` | TUIT vesting contract wallets |
| `tuit_transfers` | TUIT transfer records |
| `daily_asset_prices` | Historical prices for charting |
