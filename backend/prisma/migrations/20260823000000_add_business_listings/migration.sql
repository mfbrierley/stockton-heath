-- CreateTable
CREATE TABLE "BusinessListing" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "businessName" TEXT NOT NULL,
    "discountText" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "contactEmail" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'incomplete',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessListing_contactEmail_key" ON "BusinessListing"("contactEmail");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessListing_clerkUserId_key" ON "BusinessListing"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessListing_stripeCustomerId_key" ON "BusinessListing"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessListing_stripeSubscriptionId_key" ON "BusinessListing"("stripeSubscriptionId");
