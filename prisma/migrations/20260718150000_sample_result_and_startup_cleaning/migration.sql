CREATE TABLE "MaintenanceObligation" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "triggerEventId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "earliestDueDate" DATE,
  "targetStartDate" DATE,
  "targetEndDate" DATE,
  "latestDueDate" DATE,
  "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ObligationPriority" NOT NULL DEFAULT 'ROUTINE',
  "reason" TEXT NOT NULL,
  "ruleSetVersion" TEXT NOT NULL,
  "sourceCitation" TEXT NOT NULL,
  "completedByEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceObligation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceObligation_coolingTowerSystemId_status_latestDueDate_idx"
  ON "MaintenanceObligation"("coolingTowerSystemId", "status", "latestDueDate");
CREATE INDEX "MaintenanceObligation_triggerEventId_idx"
  ON "MaintenanceObligation"("triggerEventId");

ALTER TABLE "MaintenanceObligation"
  ADD CONSTRAINT "MaintenanceObligation_coolingTowerSystemId_fkey"
  FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceObligation"
  ADD CONSTRAINT "MaintenanceObligation_triggerEventId_fkey"
  FOREIGN KEY ("triggerEventId") REFERENCES "ServiceEvent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceObligation"
  ADD CONSTRAINT "MaintenanceObligation_completedByEventId_fkey"
  FOREIGN KEY ("completedByEventId") REFERENCES "ServiceEvent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LabResult" ADD COLUMN "sampleEventId" TEXT;

WITH ranked_results AS (
  SELECT lr."id" AS "labResultId", lr."sourceEventId",
    se."coolingTowerSystemId",
    row_number() OVER (
      PARTITION BY se."coolingTowerSystemId"
      ORDER BY se."eventDate", se."createdAt", se."id"
    ) AS ordinal
  FROM "LabResult" lr
  JOIN "ServiceEvent" se ON se."id" = lr."sourceEventId"
), ranked_samples AS (
  SELECT se."id" AS "sampleEventId", se."coolingTowerSystemId",
    row_number() OVER (
      PARTITION BY se."coolingTowerSystemId"
      ORDER BY se."eventDate", se."createdAt", se."id"
    ) AS ordinal
  FROM "ServiceEvent" se
  WHERE se."eventType" = 'ROUTINE_LEGIONELLA_SAMPLE_COLLECTED'
    AND se."status" = 'ACTIVE'
), matches AS (
  SELECT r."labResultId", r."sourceEventId", s."sampleEventId"
  FROM ranked_results r
  JOIN ranked_samples s
    ON s."coolingTowerSystemId" = r."coolingTowerSystemId"
   AND s.ordinal = r.ordinal
)
UPDATE "LabResult" lr
SET "sampleEventId" = matches."sampleEventId"
FROM matches
WHERE lr."id" = matches."labResultId";

WITH matches AS (
  SELECT lr."sourceEventId", lr."sampleEventId"
  FROM "LabResult" lr
  WHERE lr."sampleEventId" IS NOT NULL
)
UPDATE "ServiceEvent" se
SET "details" = COALESCE(se."details", '{}'::jsonb) ||
  jsonb_build_object('sampleEventId', matches."sampleEventId")
FROM matches
WHERE se."id" = matches."sourceEventId";

DELETE FROM "LabResult" WHERE "sampleEventId" IS NULL;
ALTER TABLE "LabResult" ALTER COLUMN "sampleEventId" SET NOT NULL;
CREATE UNIQUE INDEX "LabResult_sampleEventId_key" ON "LabResult"("sampleEventId");
ALTER TABLE "LabResult"
  ADD CONSTRAINT "LabResult_sampleEventId_fkey"
  FOREIGN KEY ("sampleEventId") REFERENCES "ServiceEvent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
