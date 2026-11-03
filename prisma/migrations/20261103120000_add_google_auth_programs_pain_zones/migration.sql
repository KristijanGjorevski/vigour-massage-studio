-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "googleEventId" TEXT;

-- CreateTable
CREATE TABLE "GoogleAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" DATETIME NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'почетник',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "programId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoId" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exercise_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PainZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "zoneKey" TEXT NOT NULL,
    "zoneName" TEXT NOT NULL,
    "description" TEXT,
    "serviceIds" TEXT NOT NULL,
    "exerciseIds" TEXT,
    "svgPathSelector" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAuth_shop_key" ON "GoogleAuth"("shop");

-- CreateIndex
CREATE INDEX "Program_shop_idx" ON "Program"("shop");

-- CreateIndex
CREATE INDEX "Program_category_idx" ON "Program"("category");

-- CreateIndex
CREATE INDEX "Exercise_shop_idx" ON "Exercise"("shop");

-- CreateIndex
CREATE INDEX "Exercise_programId_idx" ON "Exercise"("programId");

-- CreateIndex
CREATE INDEX "PainZone_shop_idx" ON "PainZone"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "PainZone_shop_zoneKey_key" ON "PainZone"("shop", "zoneKey");
