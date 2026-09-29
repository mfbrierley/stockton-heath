-- CreateTable
--
-- Additive and standalone. Apply it before deploying the code that writes to
-- it - see PROJECT_CONTEXT.md, migrations are applied by hand:
--
--   turso db shell stockton-heath < backend/prisma/migrations/20260929000000_add_nhs_dentist_changes/migration.sql
--
-- Deploying first does no harm: the NHS dentists sync logs that it could not
-- record its changes and carries on, and the screen is unaffected.
--
-- One row each time a nearby NHS dental practice's new-patient status changes
-- between two daily reads of nhs.uk.
CREATE TABLE IF NOT EXISTS "NhsDentistChange" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "odsCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detectedAt" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "fromGroups" TEXT NOT NULL,
    "toGroups" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NhsDentistChange_odsCode_idx" ON "NhsDentistChange"("odsCode");
