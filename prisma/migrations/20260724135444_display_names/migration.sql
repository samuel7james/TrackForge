-- CreateTable
CREATE TABLE "DisplayName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayName_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DisplayName_name_key" ON "DisplayName"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayName_viewerId_key" ON "DisplayName"("viewerId");
