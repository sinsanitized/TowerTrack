-- TowerTrack regulatory event and obligation engine.
CREATE TYPE "ServiceEventType" AS ENUM (
  'ROUTINE_LEGIONELLA_SAMPLE_COLLECTED',
  'LEGIONELLA_RESULT_RECEIVED',
  'QUARTERLY_INSPECTION_COMPLETED',
  'STARTUP',
  'SHUTDOWN',
  'STARTUP_CLEANING_DISINFECTION',
  'SUMMERTIME_HYPERHALOGENATION',
  'HIGH_LEGIONELLA_DISINFECTION',
  'FULL_REMEDIATION',
  'POWER_FAILURE',
  'BIOCIDE_LOSS',
  'CONDUCTIVITY_CONTROL_FAILURE',
  'DOH_DIRECTED_SAMPLE',
  'OTHER_DOH_CONDITION',
  'MANUAL_RISK_EVENT',
  'WEEKLY_BIOLOGICAL_INDICATOR_RESULT',
  'CLEANING_COMPLETED',
  'REPORT_SUBMITTED'
);
CREATE TYPE "ServiceEventStatus" AS ENUM ('ACTIVE', 'VOIDED', 'CORRECTED');
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'COMPLETED', 'OVERDUE', 'CANCELED', 'SUPERSEDED');
CREATE TYPE "ObligationPriority" AS ENUM ('ROUTINE', 'WARNING', 'CRITICAL', 'EMERGENCY');
CREATE TYPE "LegionellaLevel" AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4');
CREATE TYPE "ComplianceRisk" AS ENUM ('GOOD', 'UPCOMING', 'WARNING', 'CRITICAL', 'OVERDUE', 'REVIEW', 'INACTIVE');

ALTER TABLE "CoolingTowerSystem"
  ADD COLUMN "monthlyTargetStartDay" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "monthlyTargetEndDay" INTEGER NOT NULL DEFAULT 22;

CREATE TABLE "OperatingPeriod" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE,
  "startupEventId" TEXT,
  "shutdownEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatingPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperatingPeriod_startupEventId_key" ON "OperatingPeriod"("startupEventId");
CREATE UNIQUE INDEX "OperatingPeriod_shutdownEventId_key" ON "OperatingPeriod"("shutdownEventId");
CREATE INDEX "OperatingPeriod_coolingTowerSystemId_startDate_idx" ON "OperatingPeriod"("coolingTowerSystemId", "startDate");

CREATE TABLE "ServiceEvent" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "eventType" "ServiceEventType" NOT NULL,
  "eventDate" DATE NOT NULL,
  "eventTimestamp" TIMESTAMP(3),
  "status" "ServiceEventStatus" NOT NULL DEFAULT 'ACTIVE',
  "details" JSONB,
  "notes" TEXT,
  "recordedById" TEXT NOT NULL,
  "correctedFromEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ServiceEvent_coolingTowerSystemId_eventDate_idx" ON "ServiceEvent"("coolingTowerSystemId", "eventDate");
CREATE INDEX "ServiceEvent_eventType_status_idx" ON "ServiceEvent"("eventType", "status");

CREATE TABLE "SampleObligation" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "triggerEventId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "earliestDueDate" DATE,
  "targetStartDate" DATE,
  "targetEndDate" DATE,
  "latestDueDate" DATE,
  "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ObligationPriority" NOT NULL DEFAULT 'ROUTINE',
  "reason" TEXT NOT NULL,
  "ruleSetVersion" TEXT NOT NULL,
  "sourceCitation" TEXT NOT NULL,
  "completedByEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SampleObligation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SampleObligation_coolingTowerSystemId_status_latestDueDate_idx" ON "SampleObligation"("coolingTowerSystemId", "status", "latestDueDate");
CREATE INDEX "SampleObligation_triggerEventId_idx" ON "SampleObligation"("triggerEventId");

CREATE TABLE "InspectionObligation" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "triggerEventId" TEXT NOT NULL,
  "earliestDueDate" DATE,
  "targetStartDate" DATE,
  "targetEndDate" DATE,
  "latestDueDate" DATE,
  "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ObligationPriority" NOT NULL DEFAULT 'ROUTINE',
  "reason" TEXT NOT NULL,
  "ruleSetVersion" TEXT NOT NULL,
  "sourceCitation" TEXT NOT NULL,
  "completedByEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InspectionObligation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InspectionObligation_coolingTowerSystemId_status_latestDueDate_idx" ON "InspectionObligation"("coolingTowerSystemId", "status", "latestDueDate");

CREATE TABLE "ReportingObligation" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "triggerEventId" TEXT NOT NULL,
  "obligationType" TEXT NOT NULL,
  "earliestDueDate" DATE,
  "targetStartDate" DATE,
  "targetEndDate" DATE,
  "latestDueDate" DATE,
  "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ObligationPriority" NOT NULL DEFAULT 'ROUTINE',
  "reason" TEXT NOT NULL,
  "ruleSetVersion" TEXT NOT NULL,
  "sourceCitation" TEXT NOT NULL,
  "completedByEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportingObligation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReportingObligation_coolingTowerSystemId_status_latestDueDate_idx" ON "ReportingObligation"("coolingTowerSystemId", "status", "latestDueDate");

CREATE TABLE "LabResult" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "sourceEventId" TEXT NOT NULL,
  "cfuPerMl" DOUBLE PRECISION NOT NULL,
  "level" "LegionellaLevel" NOT NULL,
  "receivedDate" DATE NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "parentResultId" TEXT,
  "correctiveActionDueAt" TIMESTAMP(3),
  "remediationDueAt" TIMESTAMP(3),
  "chainClosed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LabResult_sourceEventId_key" ON "LabResult"("sourceEventId");
CREATE INDEX "LabResult_coolingTowerSystemId_receivedDate_idx" ON "LabResult"("coolingTowerSystemId", "receivedDate");

CREATE TABLE "ComplianceStatus" (
  "id" TEXT NOT NULL,
  "coolingTowerSystemId" TEXT NOT NULL,
  "risk" "ComplianceRisk" NOT NULL,
  "plainEnglishStatus" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "asOfDate" DATE NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceStatus_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ComplianceStatus_coolingTowerSystemId_key" ON "ComplianceStatus"("coolingTowerSystemId");

ALTER TABLE "OperatingPeriod" ADD CONSTRAINT "OperatingPeriod_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceEvent" ADD CONSTRAINT "ServiceEvent_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SampleObligation" ADD CONSTRAINT "SampleObligation_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SampleObligation" ADD CONSTRAINT "SampleObligation_triggerEventId_fkey" FOREIGN KEY ("triggerEventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SampleObligation" ADD CONSTRAINT "SampleObligation_completedByEventId_fkey" FOREIGN KEY ("completedByEventId") REFERENCES "ServiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InspectionObligation" ADD CONSTRAINT "InspectionObligation_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionObligation" ADD CONSTRAINT "InspectionObligation_triggerEventId_fkey" FOREIGN KEY ("triggerEventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InspectionObligation" ADD CONSTRAINT "InspectionObligation_completedByEventId_fkey" FOREIGN KEY ("completedByEventId") REFERENCES "ServiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportingObligation" ADD CONSTRAINT "ReportingObligation_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingObligation" ADD CONSTRAINT "ReportingObligation_triggerEventId_fkey" FOREIGN KEY ("triggerEventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingObligation" ADD CONSTRAINT "ReportingObligation_completedByEventId_fkey" FOREIGN KEY ("completedByEventId") REFERENCES "ServiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "ServiceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_parentResultId_fkey" FOREIGN KEY ("parentResultId") REFERENCES "LabResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceStatus" ADD CONSTRAINT "ComplianceStatus_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
