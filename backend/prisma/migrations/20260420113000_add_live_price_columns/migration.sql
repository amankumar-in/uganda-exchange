-- Live INR price state maintained by price-cache.service from CoinGecko.
ALTER TABLE "tokens"
  ADD COLUMN "currentPrice" DECIMAL(20, 8) NOT NULL DEFAULT 0,
  ADD COLUMN "change24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "pricesUpdatedAt" TIMESTAMP(3);
