-- CreateTable
--
-- Additive and standalone, so the currently deployed code keeps working
-- untouched once this is applied. Apply it BEFORE deploying the code that
-- reads it - see PROJECT_CONTEXT.md, migrations are applied by hand:
--
--   turso db shell stockton-heath < backend/prisma/migrations/20260827000000_add_welcomed_users/migration.sql
--
-- One row per business account that has been sent a welcome email. Clerk owns
-- sign-up and never tells this backend about it, so the first authenticated
-- request an account makes stands in for the event - and this table is the
-- only thing that can tell that first request from every one after it.
--
-- Nothing reads these rows back for any other purpose. An account deleted
-- from the portal leaves its row behind, which is deliberate: it is a Clerk
-- id and nothing else, and a re-used id cannot happen.
CREATE TABLE IF NOT EXISTS "WelcomedUser" (
    "clerkUserId" TEXT NOT NULL PRIMARY KEY,
    "welcomedAt" TEXT NOT NULL
);
