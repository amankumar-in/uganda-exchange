-- CreateEnum
CREATE TYPE "TuitTransferStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TuitConversionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "tuit_authorized_wallets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuit_authorized_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuit_transfers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authorizedWalletId" TEXT NOT NULL,
    "verificationEmail" TEXT NOT NULL,
    "totalAllocated" DECIMAL(30,18) NOT NULL,
    "totalUnlocked" DECIMAL(30,18) NOT NULL,
    "totalWithdrawn" DECIMAL(30,18) NOT NULL,
    "amountCredited" DECIMAL(30,18) NOT NULL,
    "status" "TuitTransferStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tuit_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuit_conversion_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "amount" DECIMAL(30,18),
    "status" "TuitConversionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuit_conversion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tuit_authorized_wallets_walletAddress_key" ON "tuit_authorized_wallets"("walletAddress");

-- CreateIndex
CREATE INDEX "tuit_authorized_wallets_email_idx" ON "tuit_authorized_wallets"("email");

-- CreateIndex
CREATE INDEX "tuit_transfers_userId_idx" ON "tuit_transfers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tuit_transfers_authorizedWalletId_key" ON "tuit_transfers"("authorizedWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "tuit_transfers_userId_authorizedWalletId_key" ON "tuit_transfers"("userId", "authorizedWalletId");

-- CreateIndex
CREATE UNIQUE INDEX "tuit_conversion_requests_txHash_key" ON "tuit_conversion_requests"("txHash");

-- CreateIndex
CREATE INDEX "tuit_conversion_requests_userId_idx" ON "tuit_conversion_requests"("userId");

-- CreateIndex
CREATE INDEX "tuit_conversion_requests_status_idx" ON "tuit_conversion_requests"("status");

-- AddForeignKey
ALTER TABLE "tuit_transfers" ADD CONSTRAINT "tuit_transfers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuit_transfers" ADD CONSTRAINT "tuit_transfers_authorizedWalletId_fkey" FOREIGN KEY ("authorizedWalletId") REFERENCES "tuit_authorized_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tuit_conversion_requests" ADD CONSTRAINT "tuit_conversion_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
