-- CreateTable
CREATE TABLE "LapRecord" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LapRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LapRecord_trackId_timeMs_idx" ON "LapRecord"("trackId", "timeMs");

-- CreateIndex
CREATE UNIQUE INDEX "LapRecord_trackId_viewerId_key" ON "LapRecord"("trackId", "viewerId");

-- AddForeignKey
ALTER TABLE "LapRecord" ADD CONSTRAINT "LapRecord_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
