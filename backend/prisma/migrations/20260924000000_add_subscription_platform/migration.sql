-- AlterTable
--
-- Records which platform each notification subscription came from, so the
-- live counts can be split by iOS and Android. Nullable: rows that already
-- exist have no platform until that device next opens the app, which re-sends
-- its subscription and fills it in.
--
-- The deployed code keeps working once this is applied. The code that writes
-- the column does NOT work before it is: Prisma reads every column of a
-- subscription when it sends a bridge alert or bin reminder, so deploying
-- first would stop both. Apply this BEFORE deploying - see PROJECT_CONTEXT.md,
-- migrations are applied by hand:
--
--   turso db shell stockton-heath < backend/prisma/migrations/20260924000000_add_subscription_platform/migration.sql
ALTER TABLE "BridgeSubscription" ADD COLUMN "platform" TEXT;
ALTER TABLE "BinSubscription" ADD COLUMN "platform" TEXT;
