-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATIONS_MANAGER', 'SCHEDULER', 'TECHNICIAN', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "JurisdictionMode" AS ENUM ('NYC_CHAPTER_8_2026_PLUS_NYS_PART_4', 'NYS_PART_4_ONLY', 'OUT_OF_STATE_COMPANY_POLICY', 'OUT_OF_STATE_GUIDANCE', 'PENDING_REGULATION', 'CUSTOM_JURISDICTION');

-- CreateEnum
CREATE TYPE "SourceAuthority" AS ENUM ('REGULATORY', 'GUIDANCE', 'COMPANY_POLICY', 'CONTRACT_REQUIREMENT', 'PENDING_REGULATION', 'UNKNOWN_REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "OperatingStatus" AS ENUM ('OPERATING', 'PARTIALLY_OPERATING', 'STARTING_UP', 'FULLY_SHUT_DOWN', 'SEASONALLY_INACTIVE', 'DECOMMISSIONED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('FUTURE', 'READY_TO_SCHEDULE', 'SCHEDULED_PENDING', 'COMPLETED', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'SUSPENDED', 'NOT_APPLICABLE', 'REQUIRES_REVIEW', 'WAITING_ON_LAB', 'WAITING_ON_THIRD_PARTY', 'OWNER_FOLLOW_UP');

-- CreateEnum
CREATE TYPE "ColorCategory" AS ENUM ('GREEN', 'YELLOW', 'RED', 'BLUE', 'GRAY', 'PURPLE');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('DRAFT', 'PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'MISSED', 'VOIDED', 'DUPLICATE', 'REPLACED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'COMPLETED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ROUTINE_LEGIONELLA_SAMPLE', 'STARTUP_LEGIONELLA_SAMPLE', 'POST_HYPERHALOGENATION_SAMPLE', 'CORRECTIVE_RETEST', 'EMERGENCY_SAMPLE', 'ROUTINE_BACTERIOLOGICAL_SAMPLE', 'WATER_QUALITY_MONITORING', 'COMPLIANCE_INSPECTION', 'ROUTINE_CLEANING', 'STARTUP_CLEANING', 'CLEANING', 'DISINFECTION', 'CLEANING_AND_DISINFECTION', 'SUMMERTIME_HYPERHALOGENATION', 'CORRECTIVE_DISINFECTION', 'FULL_REMEDIATION', 'STARTUP', 'SHUTDOWN', 'NO_CIRCULATION_EVENT', 'PORTAL_SUBMISSION', 'LAB_RESULT', 'OWNER_NOTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskOwnership" AS ENUM ('INTERNAL', 'OWNER_FOLLOW_UP', 'WAITING_ON_LAB', 'WAITING_ON_THIRD_PARTY', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "DateSource" AS ENUM ('USER_ENTRY', 'FIELD_REPORT', 'LAB_REPORT', 'CHAIN_OF_CUSTODY', 'PORTAL_CONFIRMATION', 'IMPORTED_CSV', 'CORRECTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('RUMORED', 'PROPOSED', 'PASSED_NOT_EFFECTIVE', 'AWAITING_RULEMAKING', 'FINAL_RULE_PENDING_EFFECTIVE_DATE', 'ACTIVE_REQUIRES_RULE_PROFILE_CONVERSION', 'REJECTED_OR_EXPIRED', 'UNKNOWN_REQUIRES_REVIEW');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SCHEDULER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "contacts" JSONB,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "borough" TEXT,
    "county" TEXT,
    "municipality" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "routeZone" TEXT NOT NULL,
    "accessNotes" TEXT,
    "parkingNotes" TEXT,
    "securityNotes" TEXT,
    "defaultVisitMinutes" INTEGER NOT NULL DEFAULT 60,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "state" TEXT NOT NULL,
    "county" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "notes" TEXT,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdictionMode" "JurisdictionMode" NOT NULL,
    "jurisdictionId" TEXT,
    "effectiveStartDate" DATE,
    "effectiveEndDate" DATE,
    "description" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legionellaIntervalDays" INTEGER,
    "internalTargetIntervalDays" INTEGER,
    "appliesToPartialOperation" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDefinition" (
    "id" TEXT NOT NULL,
    "ruleProfileId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "sourceAuthority" "SourceAuthority" NOT NULL,
    "sourceCitation" TEXT NOT NULL,
    "isRegulatoryRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isGuidanceRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isCompanyPolicy" BOOLEAN NOT NULL DEFAULT false,
    "isContractRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isPendingRegulation" BOOLEAN NOT NULL DEFAULT false,
    "frequencyDays" INTEGER,
    "minimumDaysAfterTrigger" INTEGER,
    "maximumDaysAfterTrigger" INTEGER,
    "dueDateCalculation" TEXT NOT NULL,
    "appliesWhenOperating" BOOLEAN NOT NULL DEFAULT true,
    "appliesWhenPartiallyOperating" BOOLEAN NOT NULL DEFAULT true,
    "appliesWhenSeasonal" BOOLEAN NOT NULL DEFAULT true,
    "appliesWhenShutdown" BOOLEAN NOT NULL DEFAULT false,
    "triggerActivityType" "ActivityType",
    "createsFollowUpRequirement" BOOLEAN NOT NULL DEFAULT false,
    "followUpRequirementType" TEXT,
    "warningDays" INTEGER NOT NULL DEFAULT 7,
    "criticalDays" INTEGER NOT NULL DEFAULT 3,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingRegulation" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "expectedRuleName" TEXT NOT NULL,
    "expectedAuthority" TEXT NOT NULL,
    "expectedEffectiveDate" DATE,
    "monitoringNotes" TEXT NOT NULL,
    "lastReviewedDate" DATE NOT NULL,
    "nextReviewDate" DATE NOT NULL,
    "sourceUrl" TEXT,
    "status" "PendingStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoolingTowerSystem" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "ruleProfileId" TEXT NOT NULL,
    "pendingRegulationId" TEXT,
    "internalJobNumber" TEXT NOT NULL,
    "systemName" TEXT NOT NULL,
    "NYCSystemId" TEXT,
    "NYSSystemId" TEXT,
    "registrationNumber" TEXT,
    "operationPeriodType" TEXT NOT NULL DEFAULT 'YEAR_ROUND',
    "operatingStatus" "OperatingStatus" NOT NULL DEFAULT 'OPERATING',
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "preferredTargetDay" INTEGER,
    "preferredWeekOfMonth" INTEGER,
    "preferredDayOfWeek" INTEGER,
    "routeZoneOverride" TEXT,
    "assignedTechnicianId" TEXT,
    "warningDays" INTEGER NOT NULL DEFAULT 7,
    "planningHorizonDays" INTEGER NOT NULL DEFAULT 21,
    "mppVersion" TEXT,
    "qualifiedPerson" TEXT,
    "laboratory" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CoolingTowerSystem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "scheduledStartTime" TEXT,
    "performedDate" DATE,
    "status" "VisitStatus" NOT NULL DEFAULT 'PLANNED',
    "assignedTechnicianId" TEXT,
    "routeId" TEXT,
    "routeSequence" INTEGER,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "actualMinutes" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitActivity" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "coolingTowerSystemId" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "scheduledDate" DATE NOT NULL,
    "performedDate" DATE,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "qualifiesForRoutineLegionella" BOOLEAN NOT NULL DEFAULT false,
    "qualifiesForInspection" BOOLEAN NOT NULL DEFAULT false,
    "qualifiesForCleaning" BOOLEAN NOT NULL DEFAULT false,
    "taskOwnershipLabel" "TaskOwnership" NOT NULL DEFAULT 'INTERNAL',
    "dateSource" "DateSource" NOT NULL DEFAULT 'USER_ENTRY',
    "ruleProfileId" TEXT NOT NULL,
    "ruleDefinitionId" TEXT,
    "sourceAuthority" "SourceAuthority" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "coolingTowerSystemId" TEXT NOT NULL,
    "requirementType" TEXT NOT NULL,
    "sourceRule" TEXT NOT NULL,
    "ruleSetVersion" TEXT NOT NULL,
    "ruleDefinitionId" TEXT NOT NULL,
    "ruleProfileId" TEXT NOT NULL,
    "sourceAuthority" "SourceAuthority" NOT NULL,
    "sourceCitation" TEXT NOT NULL,
    "isRegulatoryRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isGuidanceRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isCompanyPolicy" BOOLEAN NOT NULL DEFAULT false,
    "isContractRequirement" BOOLEAN NOT NULL DEFAULT false,
    "isPendingRegulation" BOOLEAN NOT NULL DEFAULT false,
    "earliestAllowedDate" DATE,
    "schedulingWindowStart" DATE,
    "preferredDate" DATE,
    "latestAllowedDate" DATE,
    "hardDueDate" DATE,
    "scheduledActivityId" TEXT,
    "completedActivityId" TEXT,
    "taskOwnershipLabel" "TaskOwnership" NOT NULL DEFAULT 'INTERNAL',
    "status" "RequirementStatus" NOT NULL,
    "statusColorCategory" "ColorCategory" NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveActionCase" (
    "id" TEXT NOT NULL,
    "coolingTowerSystemId" TEXT NOT NULL,
    "resultValue" DOUBLE PRECISION NOT NULL,
    "severityLevel" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "notificationDeadline" TIMESTAMP(3),
    "disinfectionDeadline" TIMESTAMP(3),
    "remediationDeadline" TIMESTAMP(3),
    "retestWindowStart" DATE,
    "retestWindowEnd" DATE,
    "closedAt" TIMESTAMP(3),
    "closureReason" TEXT,
    "sourceAuthority" "SourceAuthority" NOT NULL,

    CONSTRAINT "CorrectiveActionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "routeDate" DATE NOT NULL,
    "technicianId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatedReplacementId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "severity" "ColorCategory" NOT NULL DEFAULT 'PURPLE',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_accountNumber_key" ON "Customer"("accountNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CoolingTowerSystem_internalJobNumber_key" ON "CoolingTowerSystem"("internalJobNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleProfile" ADD CONSTRAINT "RuleProfile_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDefinition" ADD CONSTRAINT "RuleDefinition_ruleProfileId_fkey" FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRegulation" ADD CONSTRAINT "PendingRegulation_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolingTowerSystem" ADD CONSTRAINT "CoolingTowerSystem_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolingTowerSystem" ADD CONSTRAINT "CoolingTowerSystem_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolingTowerSystem" ADD CONSTRAINT "CoolingTowerSystem_ruleProfileId_fkey" FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolingTowerSystem" ADD CONSTRAINT "CoolingTowerSystem_pendingRegulationId_fkey" FOREIGN KEY ("pendingRegulationId") REFERENCES "PendingRegulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoolingTowerSystem" ADD CONSTRAINT "CoolingTowerSystem_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_ruleProfileId_fkey" FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitActivity" ADD CONSTRAINT "VisitActivity_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "RuleDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_ruleDefinitionId_fkey" FOREIGN KEY ("ruleDefinitionId") REFERENCES "RuleDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_ruleProfileId_fkey" FOREIGN KEY ("ruleProfileId") REFERENCES "RuleProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_scheduledActivityId_fkey" FOREIGN KEY ("scheduledActivityId") REFERENCES "VisitActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_completedActivityId_fkey" FOREIGN KEY ("completedActivityId") REFERENCES "VisitActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveActionCase" ADD CONSTRAINT "CorrectiveActionCase_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
