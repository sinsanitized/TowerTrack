INSERT INTO "RuleDefinition" (
  "id",
  "ruleProfileId",
  "requirementType",
  "ruleName",
  "sourceAuthority",
  "sourceCitation",
  "isRegulatoryRequirement",
  "dueDateCalculation",
  "warningDays",
  "criticalDays",
  "enabled",
  "notes",
  "updatedAt"
)
SELECT
  'nyc-cleaning',
  'nyc-2026',
  'ANNUAL_CLEANING',
  'Twice-yearly cooling tower cleaning',
  'REGULATORY'::"SourceAuthority",
  '24 RCNY §8-04',
  true,
  'TWO_COMPLETIONS_PER_CALENDAR_YEAR',
  30,
  14,
  true,
  'Cleaning is recorded separately from Legionella sampling; startup cleaning is one of the two annual cleanings.',
  CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "RuleProfile" WHERE "id" = 'nyc-2026')
ON CONFLICT ("id") DO NOTHING;
