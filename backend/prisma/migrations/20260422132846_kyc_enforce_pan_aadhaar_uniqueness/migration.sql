-- Add aadhaarHash column for uniqueness check on full Aadhaar (hashed).
ALTER TABLE "kyc" ADD COLUMN "aadhaarHash" TEXT;

-- Unique index on PAN: one PAN per account.
CREATE UNIQUE INDEX "kyc_pan_key" ON "kyc"("pan");

-- Unique index on hashed Aadhaar: one Aadhaar per account.
CREATE UNIQUE INDEX "kyc_aadhaarHash_key" ON "kyc"("aadhaarHash");
