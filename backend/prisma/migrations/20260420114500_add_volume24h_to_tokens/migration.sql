-- 24h INR trading volume from CoinGecko, refreshed by price-cache.service.
ALTER TABLE "tokens"
  ADD COLUMN "volume24h" DECIMAL(24, 2) NOT NULL DEFAULT 0;
