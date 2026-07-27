ALTER TABLE "CoolingTowerSystem"
  ADD COLUMN "seasonStartMonth" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "seasonStartDay" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "seasonEndMonth" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "seasonEndDay" INTEGER NOT NULL DEFAULT 31,
  ADD COLUMN "actualStartupDate" DATE,
  ADD COLUMN "actualShutdownDate" DATE;

UPDATE "CoolingTowerSystem"
SET
  "operationPeriodType" = CASE
    WHEN "seasonal" = true THEN 'SEASONAL'
    ELSE "operationPeriodType"
  END,
  "seasonStartMonth" = CASE
    WHEN "seasonal" = true THEN 5
    ELSE "seasonStartMonth"
  END,
  "seasonStartDay" = CASE
    WHEN "seasonal" = true THEN 1
    ELSE "seasonStartDay"
  END,
  "seasonEndMonth" = CASE
    WHEN "seasonal" = true THEN 10
    ELSE "seasonEndMonth"
  END,
  "seasonEndDay" = CASE
    WHEN "seasonal" = true THEN 31
    ELSE "seasonEndDay"
  END;
