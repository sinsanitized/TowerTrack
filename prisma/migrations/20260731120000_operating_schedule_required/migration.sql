ALTER TABLE "CoolingTowerSystem"
  ALTER COLUMN "operationPeriodType" DROP DEFAULT,
  ALTER COLUMN "operationPeriodType" DROP NOT NULL;

UPDATE "CoolingTowerSystem"
SET "operationPeriodType" = NULL
WHERE "operationPeriodType" NOT IN ('SEASONAL', 'YEAR_ROUND');

INSERT INTO "ReviewItem" (
  "id",
  "title",
  "description",
  "entityType",
  "entityId",
  "severity",
  "status",
  "createdAt"
)
SELECT
  'schedule_' || substr(md5(system."id"), 1, 16),
  'Operating schedule must be confirmed.',
  'Confirm whether this cooling tower is seasonal or year-round before relying on schedule-dependent planning.',
  'CoolingTowerSystem',
  system."id",
  'PURPLE',
  'OPEN',
  CURRENT_TIMESTAMP
FROM "CoolingTowerSystem" system
WHERE system."operationPeriodType" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "ReviewItem" review
    WHERE review."entityType" = 'CoolingTowerSystem'
      AND review."entityId" = system."id"
      AND review."title" = 'Operating schedule must be confirmed.'
      AND review."status" = 'OPEN'
  );
