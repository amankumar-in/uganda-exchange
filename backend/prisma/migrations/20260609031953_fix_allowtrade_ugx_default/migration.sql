-- AlterTable: change default for new rows
ALTER TABLE "tokens" ALTER COLUMN "allowTradeUgx" SET DEFAULT true;

-- Backfill: set allowTradeUgx=true for all existing rows that still have false
UPDATE "tokens" SET "allowTradeUgx" = true WHERE "allowTradeUgx" = false;
