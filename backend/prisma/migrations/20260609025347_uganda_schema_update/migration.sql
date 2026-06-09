/*
  Warnings:

  - You are about to drop the column `defaultAllowTradeInr` on the `global_asset_settings` table. All the data in the column will be lost.
  - You are about to drop the column `allowTradeInr` on the `tokens` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRYPTO', 'COLLEGE_COIN', 'LAND', 'COMMODITY', 'CELEBRITY');

-- AlterTable
ALTER TABLE "global_asset_settings" DROP COLUMN "defaultAllowTradeInr",
ADD COLUMN     "defaultAllowTradeUgx" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tokens" DROP COLUMN "allowTradeInr",
ADD COLUMN     "allowTradeUgx" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "assetType" "AssetType" NOT NULL DEFAULT 'CRYPTO',
ADD COLUMN     "celebrityName" TEXT,
ADD COLUMN     "commodityType" TEXT,
ADD COLUMN     "landAddress" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "kycStatus" SET DEFAULT 'APPROVED',
ALTER COLUMN "appMode" SET DEFAULT 'INVESTOR';
