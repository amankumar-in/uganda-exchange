-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "coingeckoId" TEXT,
    "contractAddress" TEXT,
    "chain" TEXT,
    "manualPrice" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "allowBuy" BOOLEAN NOT NULL DEFAULT false,
    "allowSell" BOOLEAN NOT NULL DEFAULT false,
    "allowTradeUsdt" BOOLEAN NOT NULL DEFAULT false,
    "allowTradeUsd" BOOLEAN NOT NULL DEFAULT false,
    "allowTradeEth" BOOLEAN NOT NULL DEFAULT false,
    "allowTradeTuit" BOOLEAN NOT NULL DEFAULT false,
    "allowDeposit" BOOLEAN NOT NULL DEFAULT false,
    "allowWithdraw" BOOLEAN NOT NULL DEFAULT false,
    "allowP2P" BOOLEAN NOT NULL DEFAULT false,
    "minTransactionAmount" DECIMAL(20,8) NOT NULL DEFAULT 10,
    "maxTransactionAmount" DECIMAL(20,8) NOT NULL DEFAULT 5000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "website" TEXT,
    "whitepaper" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_symbol_key" ON "tokens"("symbol");
