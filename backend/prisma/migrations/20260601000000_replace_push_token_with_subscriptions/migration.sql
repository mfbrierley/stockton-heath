-- CreateTable
CREATE TABLE "BridgeSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeSubscription_token_key" ON "BridgeSubscription"("token");

-- Migrate existing PushToken rows into BridgeSubscription
INSERT INTO "BridgeSubscription" ("token")
SELECT "token" FROM "PushToken";

-- CreateTable
CREATE TABLE "BinSubscription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "token" TEXT NOT NULL,
    "uprn" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BinSubscription_token_key" ON "BinSubscription"("token");

-- DropTable
DROP TABLE "PushToken";
