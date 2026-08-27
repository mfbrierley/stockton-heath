-- CreateTable
--
-- Additive and standalone, so the currently deployed code keeps working
-- untouched once this is applied. Apply it BEFORE deploying the code that
-- reads it - see PROJECT_CONTEXT.md, migrations are applied by hand:
--
--   turso db shell stockton-heath < backend/prisma/migrations/20260828000000_add_reminded_listings/migration.sql
--
-- One row per listing that has been sent the "you haven't subscribed yet"
-- reminder. The insert is the lock: whoever writes the row sends the email,
-- so a listing is nudged exactly once however many times the sweep runs.
--
-- Not a foreign key. Removing a listing deletes the row outright, and a
-- constraint would either block that or quietly undo the record of having
-- already emailed them. Ids are never reused, so a stale row is inert.
CREATE TABLE "RemindedListing" (
    "listingId" INTEGER NOT NULL PRIMARY KEY,
    "remindedAt" TEXT NOT NULL
);

-- Every listing that already exists counts as already reminded.
--
-- Without this the first sweep after deploying would email every business
-- that has ever saved a discount and not paid, in one burst - people who
-- signed up months ago, told out of nowhere that they haven't finished. A
-- nudge a day later is helpful; the same nudge a season later, to everyone
-- at once, reads as a system that has gone wrong.
--
-- So the reminder only ever applies to listings written after this is
-- applied. To nudge an old one deliberately, delete its row from here.
INSERT INTO "RemindedListing" ("listingId", "remindedAt")
SELECT "id", 'backfilled-at-migration' FROM "BusinessListing";
