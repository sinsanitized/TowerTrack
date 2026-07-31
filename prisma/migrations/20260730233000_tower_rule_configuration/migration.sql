CREATE TYPE "TowerRuleConfiguration" AS ENUM ('NYC_AND_NYS', 'NYS_ONLY', 'CUSTOM');

ALTER TABLE "CoolingTowerSystem"
  ADD COLUMN "ruleConfiguration" "TowerRuleConfiguration",
  ADD COLUMN "ruleConfigurationEffectiveDate" DATE,
  ADD COLUMN "ruleConfigurationConfirmed" BOOLEAN NOT NULL DEFAULT true;

UPDATE "CoolingTowerSystem" system
SET
  "ruleConfiguration" = CASE
    WHEN profile."jurisdictionMode" = 'NYC_CHAPTER_8_2026_PLUS_NYS_PART_4'
      THEN 'NYC_AND_NYS'::"TowerRuleConfiguration"
    WHEN profile."jurisdictionMode" = 'NYS_PART_4_ONLY'
      THEN 'NYS_ONLY'::"TowerRuleConfiguration"
    ELSE 'CUSTOM'::"TowerRuleConfiguration"
  END,
  "ruleConfigurationEffectiveDate" = COALESCE(
    profile."effectiveStartDate",
    system."createdAt"::date
  ),
  "ruleConfigurationConfirmed" = profile."jurisdictionMode" NOT IN (
    'OUT_OF_STATE_GUIDANCE', 'PENDING_REGULATION', 'CUSTOM_JURISDICTION'
  )
FROM "RuleProfile" profile
WHERE profile."id" = system."ruleProfileId";

ALTER TABLE "CoolingTowerSystem"
  ALTER COLUMN "ruleConfiguration" SET NOT NULL,
  ALTER COLUMN "ruleConfigurationEffectiveDate" SET NOT NULL;

CREATE TABLE "TowerRuleAssignment" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "configuration" "TowerRuleConfiguration" NOT NULL,
  "ruleProfileId" TEXT NOT NULL,
  "effectiveStartDate" DATE NOT NULL,
  "effectiveEndDate" DATE,
  "requiresReview" BOOLEAN NOT NULL DEFAULT false,
  "changedById" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TowerRuleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TowerRuleAssignment_coolingTowerSystemId_fkey"
    FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TowerRuleAssignment_ruleProfileId_fkey"
    FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TowerRuleAssignment_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "TowerRuleAssignment_coolingTowerSystemId_effectiveStartDate_effectiveEndDate_idx"
  ON "TowerRuleAssignment"("coolingTowerSystemId", "effectiveStartDate", "effectiveEndDate");
CREATE INDEX "TowerRuleAssignment_ruleProfileId_idx"
  ON "TowerRuleAssignment"("ruleProfileId");
CREATE UNIQUE INDEX "TowerRuleAssignment_one_active_per_tower"
  ON "TowerRuleAssignment"("coolingTowerSystemId")
  WHERE "effectiveEndDate" IS NULL;

INSERT INTO "TowerRuleAssignment" (
  "id", "coolingTowerSystemId", "configuration", "ruleProfileId",
  "effectiveStartDate", "requiresReview", "reason"
)
SELECT
  'rule-assignment-' || system."id",
  system."id",
  system."ruleConfiguration",
  system."ruleProfileId",
  system."ruleConfigurationEffectiveDate",
  NOT system."ruleConfigurationConfirmed",
  CASE
    WHEN system."ruleConfigurationConfirmed"
      THEN 'Backfilled from the tower''s explicit pre-migration rule profile assignment.'
    ELSE 'Compliance rules must be confirmed; the prior profile was ambiguous.'
  END
FROM "CoolingTowerSystem" system
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ReviewItem" (
  "id", "title", "description", "entityType", "entityId", "severity", "status", "createdAt"
)
SELECT
  'rule-configuration-review-' || system."id",
  'Compliance rules must be confirmed.',
  'The prior profile was preserved as Custom / Out of State, but an authorized user must confirm the applicable company, customer, and local requirements.',
  'CoolingTowerSystem', system."id", 'PURPLE', 'OPEN', CURRENT_TIMESTAMP
FROM "CoolingTowerSystem" system
WHERE system."ruleConfigurationConfirmed" = false
ON CONFLICT ("id") DO NOTHING;
