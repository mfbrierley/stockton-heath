-- AlterTable
--
-- Both columns are additive and carry defaults, so the currently deployed code
-- keeps working untouched once this is applied. Apply it BEFORE deploying the
-- code that reads them - see PROJECT_CONTEXT.md, migrations are applied by hand:
--
--   turso db shell stockton-heath < backend/prisma/migrations/20260825000000_add_subscription_period_fields/migration.sql
ALTER TABLE "BusinessListing" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BusinessListing" ADD COLUMN "currentPeriodEnd" TEXT;
