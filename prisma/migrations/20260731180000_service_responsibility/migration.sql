CREATE TYPE "ServiceResponsibility" AS ENUM ('OUR_COMPANY', 'CUSTOMER', 'OTHER_VENDOR', 'NOT_TRACKED');

ALTER TABLE "CoolingTowerSystem"
  ADD COLUMN "legionellaResponsibility" "ServiceResponsibility",
  ADD COLUMN "legionellaVendorName" TEXT;

ALTER TABLE "ServiceEvent"
  ADD COLUMN "performedByResponsibility" "ServiceResponsibility" NOT NULL DEFAULT 'OUR_COMPANY',
  ADD COLUMN "externalProviderName" TEXT,
  ADD COLUMN "externalSource" TEXT;

INSERT INTO "ReviewItem" ("id", "title", "description", "entityType", "entityId", "severity", "status", "createdAt")
SELECT
  'service-responsibility-' || "id",
  'Legionella responsibility must be confirmed',
  'Choose whether Legionella is managed by our company, the customer, another vendor, or is not tracked in TowerTrack.',
  'CoolingTowerSystem',
  "id",
  'PURPLE',
  'OPEN',
  CURRENT_TIMESTAMP
FROM "CoolingTowerSystem"
WHERE "deletedAt" IS NULL;
