/*
  Warnings:

  - You are about to drop the column `dateOfBirth` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `documentCountry` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `documentState` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `documentType` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `firstName` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `middleName` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `stateValidated` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffAttemptId` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffDecisionTime` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffReason` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffSessionId` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffStatus` on the `kyc` table. All the data in the column will be lost.
  - You are about to drop the column `veriffSessionId` on the `kyc_rejection_logs` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "kyc_veriffSessionId_key";

-- AlterTable
ALTER TABLE "kyc" DROP COLUMN "dateOfBirth",
DROP COLUMN "documentCountry",
DROP COLUMN "documentState",
DROP COLUMN "documentType",
DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "middleName",
DROP COLUMN "stateValidated",
DROP COLUMN "veriffAttemptId",
DROP COLUMN "veriffDecisionTime",
DROP COLUMN "veriffReason",
DROP COLUMN "veriffSessionId",
DROP COLUMN "veriffStatus",
ADD COLUMN     "aadhaarCareOf" TEXT,
ADD COLUMN     "aadhaarDob" TIMESTAMP(3),
ADD COLUMN     "aadhaarGender" TEXT,
ADD COLUMN     "aadhaarLast4" TEXT,
ADD COLUMN     "aadhaarName" TEXT,
ADD COLUMN     "aadhaarOtpSentAt" TIMESTAMP(3),
ADD COLUMN     "aadhaarPhotoPath" TEXT,
ADD COLUMN     "aadhaarRawData" JSONB,
ADD COLUMN     "aadhaarRefId" TEXT,
ADD COLUMN     "aadhaarVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "aadhaarYob" TEXT,
ADD COLUMN     "autoDecidedAt" TIMESTAMP(3),
ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "panAadhaarLinked" BOOLEAN,
ADD COLUMN     "panAadhaarLinkedAt" TIMESTAMP(3),
ADD COLUMN     "panAadhaarSeeding" TEXT,
ADD COLUMN     "panDob" TIMESTAMP(3),
ADD COLUMN     "panDobMatch" BOOLEAN,
ADD COLUMN     "panName" TEXT,
ADD COLUMN     "panNameMatch" BOOLEAN,
ADD COLUMN     "panRawData" JSONB,
ADD COLUMN     "panStatus" TEXT,
ADD COLUMN     "panVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "selfiePath" TEXT,
ADD COLUMN     "selfieUploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "kyc_rejection_logs" DROP COLUMN "veriffSessionId",
ADD COLUMN     "providerRefId" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "country" SET DEFAULT 'IN';
