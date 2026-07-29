-- CreateIndex
CREATE INDEX "Comment_displayName_idx" ON "Comment"("displayName");

-- CreateIndex
CREATE INDEX "LapRecord_viewerId_idx" ON "LapRecord"("viewerId");

-- CreateIndex
CREATE INDEX "Like_viewerId_idx" ON "Like"("viewerId");
