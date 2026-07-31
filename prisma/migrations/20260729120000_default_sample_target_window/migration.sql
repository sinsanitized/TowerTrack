-- Move systems still using the former default window to the new company
-- scheduling target. Explicitly customized windows are preserved.
UPDATE "CoolingTowerSystem"
SET
  "monthlyTargetStartDay" = 20,
  "monthlyTargetEndDay" = 25
WHERE
  "monthlyTargetStartDay" = 15
  AND "monthlyTargetEndDay" = 22;

ALTER TABLE "CoolingTowerSystem"
  ALTER COLUMN "monthlyTargetStartDay" SET DEFAULT 20,
  ALTER COLUMN "monthlyTargetEndDay" SET DEFAULT 25;
