-- CreateTable
CREATE TABLE "user_mining_colleges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_mining_colleges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_mining_colleges_userId_idx" ON "user_mining_colleges"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_mining_colleges_userId_tokenId_key" ON "user_mining_colleges"("userId", "tokenId");

-- AddForeignKey
ALTER TABLE "user_mining_colleges" ADD CONSTRAINT "user_mining_colleges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mining_colleges" ADD CONSTRAINT "user_mining_colleges_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
