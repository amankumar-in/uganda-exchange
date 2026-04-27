-- ============================================
-- KYC overhaul migration
-- Issues addressed: 9, 10, 21, 27, 30, 43
-- ============================================

-- 43: extend KycStatus enum (Postgres requires ALTER TYPE one value at a time)
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "KycStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- 9, 10: explicit ref-id TTL column. Sandbox/UIDAI ref-ids expire ~10-30 min;
-- without this we treated stale ref-ids as live and trapped users.
ALTER TABLE "kyc" ADD COLUMN IF NOT EXISTS "aadhaarRefIdExpiresAt" TIMESTAMP(3);

-- 21: surface the last Sandbox transaction_id (their support uses it for debugging).
ALTER TABLE "kyc" ADD COLUMN IF NOT EXISTS "lastSandboxTxnId" TEXT;

-- 30: index on status for admin queue/list scans.
CREATE INDEX IF NOT EXISTS "kyc_status_idx" ON "kyc"("status");

-- 27: append-only history of submissions. Lets a regulator answer
-- "what did this user submit on date X" even after retries overwrite the live row.
CREATE TABLE IF NOT EXISTS "kyc_submissions" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pan" TEXT,
    "panName" TEXT,
    "panStatus" TEXT,
    "panNameMatch" BOOLEAN,
    "panDobMatch" BOOLEAN,
    "aadhaarLast4" TEXT,
    "aadhaarName" TEXT,
    "aadhaarDob" TIMESTAMP(3),
    "panAadhaarLinked" BOOLEAN,
    "status" "KycStatus" NOT NULL,
    "rejectionReason" TEXT,
    "decisionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kyc_submissions_userId_idx" ON "kyc_submissions"("userId");
CREATE INDEX IF NOT EXISTS "kyc_submissions_kycId_idx" ON "kyc_submissions"("kycId");

-- FK from history → live row. ON DELETE CASCADE so wiping a Kyc row also wipes history;
-- in practice we never hard-delete (kycs cascade only via user delete).
ALTER TABLE "kyc_submissions"
    ADD CONSTRAINT "kyc_submissions_kycId_fkey"
    FOREIGN KEY ("kycId") REFERENCES "kyc"("id") ON DELETE CASCADE ON UPDATE CASCADE;
