-- CreateTable
CREATE TABLE "global_asset_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultAllowBuy" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowSell" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowP2P" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowDeposit" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowWithdraw" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowTradeUsd" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowTradeUsdt" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowTradeEth" BOOLEAN NOT NULL DEFAULT false,
    "defaultAllowTradeTuit" BOOLEAN NOT NULL DEFAULT false,
    "defaultMinTransaction" DECIMAL(20,8) NOT NULL DEFAULT 10,
    "defaultMaxTransaction" DECIMAL(20,8) NOT NULL DEFAULT 5000,
    "defaultMiningBaseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "defaultMiningSessionHours" INTEGER NOT NULL DEFAULT 24,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_asset_settings_pkey" PRIMARY KEY ("id")
);
