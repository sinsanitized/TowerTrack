CREATE TABLE "CleaningJob" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "addVisitId" TEXT NOT NULL,
    "cleaningVisitId" TEXT NOT NULL,
    "scopeMode" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "CleaningJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CleaningJobTower" (
    "id" TEXT NOT NULL,
    "cleaningJobId" TEXT NOT NULL,
    "coolingTowerSystemId" TEXT NOT NULL,
    "systemNameSnapshot" TEXT NOT NULL,
    "completedByServiceEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CleaningJobTower_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CleaningJob_addVisitId_key" ON "CleaningJob"("addVisitId");
CREATE UNIQUE INDEX "CleaningJob_cleaningVisitId_key" ON "CleaningJob"("cleaningVisitId");
CREATE INDEX "CleaningJob_buildingId_createdAt_idx" ON "CleaningJob"("buildingId", "createdAt");
CREATE UNIQUE INDEX "CleaningJobTower_cleaningJobId_coolingTowerSystemId_key" ON "CleaningJobTower"("cleaningJobId", "coolingTowerSystemId");
CREATE UNIQUE INDEX "CleaningJobTower_completedByServiceEventId_key" ON "CleaningJobTower"("completedByServiceEventId");

ALTER TABLE "CleaningJob" ADD CONSTRAINT "CleaningJob_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningJob" ADD CONSTRAINT "CleaningJob_addVisitId_fkey" FOREIGN KEY ("addVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningJob" ADD CONSTRAINT "CleaningJob_cleaningVisitId_fkey" FOREIGN KEY ("cleaningVisitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningJob" ADD CONSTRAINT "CleaningJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningJobTower" ADD CONSTRAINT "CleaningJobTower_cleaningJobId_fkey" FOREIGN KEY ("cleaningJobId") REFERENCES "CleaningJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CleaningJobTower" ADD CONSTRAINT "CleaningJobTower_coolingTowerSystemId_fkey" FOREIGN KEY ("coolingTowerSystemId") REFERENCES "CoolingTowerSystem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningJobTower" ADD CONSTRAINT "CleaningJobTower_completedByServiceEventId_fkey" FOREIGN KEY ("completedByServiceEventId") REFERENCES "ServiceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
