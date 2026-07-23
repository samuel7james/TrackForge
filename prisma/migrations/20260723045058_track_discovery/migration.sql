-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "playCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Track_isPublished_createdAt_idx" ON "Track"("isPublished", "createdAt");

-- CreateIndex
CREATE INDEX "Track_isPublished_playCount_idx" ON "Track"("isPublished", "playCount");
