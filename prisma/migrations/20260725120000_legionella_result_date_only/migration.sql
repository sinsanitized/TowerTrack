-- Legionella result receipt is a date-only domain value. Existing timestamps
-- are preserved as their New York compliance calendar date; no local browser
-- conversion is used.
ALTER TABLE "LabResult"
  ALTER COLUMN "receivedAt" TYPE DATE
  USING ("receivedAt" AT TIME ZONE 'America/New_York')::date;

UPDATE "ServiceEvent"
SET "eventTimestamp" = NULL
WHERE "eventType" = 'LEGIONELLA_RESULT_RECEIVED';

ALTER TYPE "ObligationStatus" ADD VALUE IF NOT EXISTS 'MISSED';
