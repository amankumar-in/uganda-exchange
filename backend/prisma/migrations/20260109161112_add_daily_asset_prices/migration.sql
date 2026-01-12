-- CreateTable
CREATE TABLE "daily_asset_prices" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_asset_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_asset_prices_date_idx" ON "daily_asset_prices"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_asset_prices_asset_date_key" ON "daily_asset_prices"("asset", "date");
