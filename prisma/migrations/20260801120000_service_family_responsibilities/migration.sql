ALTER TABLE "CoolingTowerSystem"
ADD COLUMN "laboratoryResultResponsibility" "ServiceResponsibility",
ADD COLUMN "bacteriologicalResponsibility" "ServiceResponsibility",
ADD COLUMN "inspectionResponsibility" "ServiceResponsibility",
ADD COLUMN "cleaningResponsibility" "ServiceResponsibility",
ADD COLUMN "waterTreatmentResponsibility" "ServiceResponsibility",
ADD COLUMN "regulatoryReportingResponsibility" "ServiceResponsibility",
ADD COLUMN "certificationResponsibility" "ServiceResponsibility";

UPDATE "CoolingTowerSystem"
SET
  "laboratoryResultResponsibility" = "legionellaResponsibility",
  "bacteriologicalResponsibility" = 'CUSTOMER',
  "inspectionResponsibility" = 'OUR_COMPANY',
  "cleaningResponsibility" = 'OUR_COMPANY',
  "waterTreatmentResponsibility" = 'OUR_COMPANY',
  "regulatoryReportingResponsibility" = 'OUR_COMPANY',
  "certificationResponsibility" = 'CUSTOMER'
WHERE "legionellaResponsibility" IS NOT NULL;
