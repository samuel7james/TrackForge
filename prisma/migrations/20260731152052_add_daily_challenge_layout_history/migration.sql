-- CreateTable
CREATE TABLE "DailyChallengeLayout" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyChallengeLayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyChallengeLayout_fingerprint_key" ON "DailyChallengeLayout"("fingerprint");

-- CreateIndex
CREATE INDEX "DailyChallengeLayout_createdAt_idx" ON "DailyChallengeLayout"("createdAt");
