-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "difficulty" TEXT NOT NULL DEFAULT 'beginner';

-- CreateIndex
CREATE INDEX "Track_tags_idx" ON "Track" USING GIN ("tags");
