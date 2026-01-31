-- AlterTable
ALTER TABLE "kyc" ADD COLUMN     "documentCountry" TEXT,
ADD COLUMN     "documentState" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "stateValidated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "allowed_countries" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowAllStates" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_states" (
    "id" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allowed_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_rejection_logs" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rejectionType" TEXT NOT NULL,
    "userProvidedCountry" TEXT,
    "userProvidedState" TEXT,
    "documentCountry" TEXT,
    "documentState" TEXT,
    "reason" TEXT NOT NULL,
    "veriffSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_rejection_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_countries_countryCode_key" ON "allowed_countries"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_states_countryId_stateCode_key" ON "allowed_states"("countryId", "stateCode");

-- CreateIndex
CREATE INDEX "kyc_rejection_logs_userId_idx" ON "kyc_rejection_logs"("userId");

-- CreateIndex
CREATE INDEX "kyc_rejection_logs_kycId_idx" ON "kyc_rejection_logs"("kycId");

-- AddForeignKey
ALTER TABLE "allowed_states" ADD CONSTRAINT "allowed_states_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "allowed_countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
