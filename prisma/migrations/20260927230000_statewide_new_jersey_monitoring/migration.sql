-- Pending New Jersey monitoring is statewide. It must not be tied to a single
-- municipality because no active municipal rule is being represented.
UPDATE "RuleProfile"
SET "jurisdictionId" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pending'
  AND "jurisdictionMode" = 'PENDING_REGULATION';
