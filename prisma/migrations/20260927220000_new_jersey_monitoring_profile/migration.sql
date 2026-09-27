-- Add the non-regulatory New Jersey monitoring profile to existing databases.
-- This profile intentionally has no timing interval and creates no legal deadline.
INSERT INTO "RuleProfile" (
  "id",
  "name",
  "jurisdictionMode",
  "jurisdictionId",
  "effectiveStartDate",
  "description",
  "isDefault",
  "active",
  "legionellaIntervalDays",
  "internalTargetIntervalDays",
  "appliesToPartialOperation",
  "createdAt",
  "updatedAt"
)
SELECT
  'pending',
  'Pending Regulation Review',
  'PENDING_REGULATION'::"JurisdictionMode",
  jurisdiction."id",
  NULL,
  'Monitoring only. Generates no hard deadline.',
  true,
  true,
  NULL,
  NULL,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Jurisdiction" jurisdiction
WHERE jurisdiction."state" = 'NJ'
ORDER BY jurisdiction."id"
LIMIT 1
ON CONFLICT ("id") DO NOTHING;
