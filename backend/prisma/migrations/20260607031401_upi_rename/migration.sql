/*
  Warnings:

  - The values [UPI] on the enum `P2PPaymentMethodType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "P2PPaymentMethodType_new" AS ENUM ('BANK_TRANSFER', 'MOBILE_MONEY', 'PAYPAL', 'VENMO', 'ZELLE', 'CASH_APP', 'WISE', 'REVOLUT', 'OTHER');
ALTER TABLE "p2p_payment_methods" ALTER COLUMN "type" TYPE "P2PPaymentMethodType_new" USING ("type"::text::"P2PPaymentMethodType_new");
ALTER TABLE "p2p_trades" ALTER COLUMN "paymentMethodType" TYPE "P2PPaymentMethodType_new" USING ("paymentMethodType"::text::"P2PPaymentMethodType_new");
ALTER TYPE "P2PPaymentMethodType" RENAME TO "P2PPaymentMethodType_old";
ALTER TYPE "P2PPaymentMethodType_new" RENAME TO "P2PPaymentMethodType";
DROP TYPE "public"."P2PPaymentMethodType_old";
COMMIT;
