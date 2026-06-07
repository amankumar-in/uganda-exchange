-- AlterTable
ALTER TABLE "fiat_balances" ALTER COLUMN "currency" SET DEFAULT 'UGX';

-- AlterTable
ALTER TABLE "learner_fiat_balances" ALTER COLUMN "currency" SET DEFAULT 'UGX',
ALTER COLUMN "balance" SET DEFAULT 500000,
ALTER COLUMN "availableBalance" SET DEFAULT 500000;
