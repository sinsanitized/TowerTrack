ALTER TYPE "ServiceEventType" ADD VALUE IF NOT EXISTS 'BACTERIOLOGICAL_SAMPLE_COLLECTED' AFTER 'ROUTINE_LEGIONELLA_SAMPLE_COLLECTED';

ALTER TABLE "RuleProfile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "RuleProfile"
  ADD CONSTRAINT "RuleProfile_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Jurisdiction" ("id", "country", "state", "county", "notes")
VALUES ('jurisdiction-nys-outside-nyc', 'US', 'NY', NULL, 'New York State outside New York City')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ReviewItem" (
  "id", "title", "description", "entityType", "entityId", "severity", "status", "createdAt"
)
SELECT
  'jurisdiction-review-' || system."id",
  'Compliance jurisdiction must be confirmed.',
  'The existing profile is custom, guidance-only, pending, or otherwise ambiguous. Preserve current calculations until an authorized user confirms the correct base jurisdiction profile.',
  'CoolingTowerSystem', system."id", 'PURPLE', 'OPEN', CURRENT_TIMESTAMP
FROM "CoolingTowerSystem" system
JOIN "RuleProfile" profile ON profile."id" = system."ruleProfileId"
WHERE profile."jurisdictionMode" IN (
  'OUT_OF_STATE_GUIDANCE', 'PENDING_REGULATION', 'CUSTOM_JURISDICTION'
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RuleProfile" (
  "id", "name", "jurisdictionMode", "jurisdictionId", "effectiveStartDate",
  "description", "isDefault", "active", "legionellaIntervalDays",
  "internalTargetIntervalDays", "appliesToPartialOperation", "createdAt", "updatedAt"
) VALUES
  (
    'nys-only', 'New York State — 10 NYCRR Subpart 4-1', 'NYS_PART_4_ONLY',
    'jurisdiction-nys-outside-nyc', DATE '2016-07-06',
    'New York State outside NYC. NYC Chapter 8 obligations are not included.',
    true, true, 90, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'oos-policy', 'Custom — Standard Company Cooling Tower Program',
    'OUT_OF_STATE_COMPANY_POLICY', NULL, DATE '2026-07-30',
    'Empty custom profile. Administrators must explicitly enable company or customer requirements and verify local law.',
    true, true, NULL, NULL, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RuleDefinition" (
  "id", "revision", "ruleProfileId", "requirementType", "ruleName",
  "sourceAuthority", "sourceCitation", "isRegulatoryRequirement",
  "frequencyDays", "dueDateCalculation", "enabled", "createdAt", "updatedAt"
) VALUES
  ('nys-only-legionella', 1, 'nys-only', 'ROUTINE_LEGIONELLA_SAMPLE', 'NYS routine Legionella culture sampling', 'REGULATORY', '10 NYCRR §4-1.4(b)(2)', true, 90, 'LAST_QUALIFYING_ACTIVITY_PLUS_FREQUENCY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nys-bac', 1, 'nys-only', 'ROUTINE_BACTERIOLOGICAL_SAMPLE', 'NYS routine bacteriological culture sampling', 'REGULATORY', '10 NYCRR §4-1.4(b)(1)', true, 30, 'LAST_QUALIFYING_ACTIVITY_PLUS_FREQUENCY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nys-inspection', 1, 'nys-only', 'COMPLIANCE_INSPECTION', 'NYS cooling tower inspection', 'REGULATORY', '10 NYCRR §4-1.8(a)', true, 90, 'LAST_QUALIFYING_ACTIVITY_PLUS_FREQUENCY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nys-reporting', 1, 'nys-only', 'NYS_REGISTRY_REPORTING', 'NYS registry reporting', 'REGULATORY', '10 NYCRR §4-1.3', true, 90, 'TRIGGER_PLUS_FREQUENCY', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('nys-certification', 1, 'nys-only', 'ANNUAL_CERTIFICATION', 'NYS annual certification', 'REGULATORY', '10 NYCRR §4-1.8(b)', true, NULL, 'ANNUAL_NOVEMBER_1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "RuleDefinition" (
  "id", "revision", "ruleProfileId", "requirementType", "ruleName",
  "sourceAuthority", "sourceCitation", "isCompanyPolicy", "frequencyDays",
  "dueDateCalculation", "enabled", "notes", "createdAt", "updatedAt"
) VALUES (
  'oos-policy-legionella', 1, 'oos-policy', 'ROUTINE_LEGIONELLA_SAMPLE',
  'Custom Legionella sampling', 'COMPANY_POLICY',
  'Company policy — verify local requirements', true, NULL, 'REVIEW_ONLY', false,
  'Disabled safe default. An administrator must configure and enable this requirement.',
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
