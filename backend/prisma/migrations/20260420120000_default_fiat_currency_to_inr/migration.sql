-- Update default fiat currency from USD to INR on both live and learner balance tables.
-- Also raise learner starting balance default from 10,000 to 1,00,000 (₹1 lakh).
ALTER TABLE "fiat_balances" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "learner_fiat_balances" ALTER COLUMN "currency" SET DEFAULT 'INR';
ALTER TABLE "learner_fiat_balances" ALTER COLUMN "balance" SET DEFAULT 100000;
ALTER TABLE "learner_fiat_balances" ALTER COLUMN "availableBalance" SET DEFAULT 100000;
