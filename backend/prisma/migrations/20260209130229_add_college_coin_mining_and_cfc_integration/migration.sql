-- CreateEnum
CREATE TYPE "MiningSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CfcMigrationStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CfcLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "MigrationRecordStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "tokens" ADD COLUMN     "collegeCfcId" TEXT,
ADD COLUMN     "collegeCountry" TEXT,
ADD COLUMN     "collegeLogo" TEXT,
ADD COLUMN     "collegeName" TEXT,
ADD COLUMN     "isCollegeCoin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "miningAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "miningBaseRate" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
ADD COLUMN     "miningSessionHours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "mining_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "earningRate" DOUBLE PRECISION NOT NULL,
    "tokensEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stoppedAt" TIMESTAMP(3),
    "status" "MiningSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mining_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mining_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfcUserId" TEXT,
    "cfcMigrationDate" TIMESTAMP(3),
    "cfcMigrationStatus" "CfcMigrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "totalTokensMined" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mining_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfc_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfcUserId" TEXT NOT NULL,
    "cfcEmail" TEXT NOT NULL,
    "bridgeToken" TEXT NOT NULL,
    "bridgeTokenHash" TEXT NOT NULL,
    "status" "CfcLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "cfc_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "migration_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cfcWalletId" TEXT NOT NULL,
    "collegeCfcId" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "MigrationRecordStatus" NOT NULL DEFAULT 'PENDING',
    "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "errorMessage" TEXT,

    CONSTRAINT "migration_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mining_sessions_userId_tokenId_isActive_idx" ON "mining_sessions"("userId", "tokenId", "isActive");

-- CreateIndex
CREATE INDEX "mining_sessions_endTime_isActive_idx" ON "mining_sessions"("endTime", "isActive");

-- CreateIndex
CREATE INDEX "mining_sessions_userId_isActive_endTime_idx" ON "mining_sessions"("userId", "isActive", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "user_mining_profiles_userId_key" ON "user_mining_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cfc_links_userId_key" ON "cfc_links"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cfc_links_cfcUserId_key" ON "cfc_links"("cfcUserId");

-- CreateIndex
CREATE UNIQUE INDEX "migration_records_cfcWalletId_key" ON "migration_records"("cfcWalletId");

-- CreateIndex
CREATE INDEX "migration_records_userId_idx" ON "migration_records"("userId");

-- AddForeignKey
ALTER TABLE "mining_sessions" ADD CONSTRAINT "mining_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mining_sessions" ADD CONSTRAINT "mining_sessions_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mining_profiles" ADD CONSTRAINT "user_mining_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfc_links" ADD CONSTRAINT "cfc_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "migration_records" ADD CONSTRAINT "migration_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
