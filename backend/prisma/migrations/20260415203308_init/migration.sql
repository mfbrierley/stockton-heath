-- CreateTable
CREATE TABLE "BridgeAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tweetId" TEXT NOT NULL,
    "tweetText" TEXT NOT NULL,
    "postedAt" TEXT NOT NULL,
    "detectedAt" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeAlert_tweetId_key" ON "BridgeAlert"("tweetId");
