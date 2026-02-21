-- AlterTable
ALTER TABLE "tuit_authorized_wallets" ADD COLUMN     "isTestPair" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "testTotalAllocated" DECIMAL(30,18),
ADD COLUMN     "testUnlocked" DECIMAL(30,18),
ADD COLUMN     "testWithdrawn" DECIMAL(30,18);
