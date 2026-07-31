CREATE TYPE "LegacyImportBatchStatus" AS ENUM ('PREVIEWED', 'CONFIRMED', 'PARTIAL', 'ROLLED_BACK');
CREATE TYPE "LegacyImportRowStatus" AS ENUM ('READY', 'READY_WITH_WARNINGS', 'NEEDS_REVIEW', 'EXCLUDED', 'IMPORTED', 'SKIPPED', 'ROLLED_BACK');

CREATE TABLE "LegacyImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "importedById" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "status" "LegacyImportBatchStatus" NOT NULL DEFAULT 'PREVIEWED',
    "previewCounts" JSONB NOT NULL,
    "confirmedCounts" JSONB,
    "mapping" JSONB NOT NULL,
    "warnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "LegacyImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegacyImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "worksheetName" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "originalJobNumber" TEXT,
    "status" "LegacyImportRowStatus" NOT NULL,
    "proposedData" JSONB NOT NULL,
    "sourceCells" JSONB NOT NULL,
    "recognizedEvents" JSONB NOT NULL,
    "ambiguousCells" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "errors" JSONB NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdCustomerId" TEXT,
    "createdBuildingId" TEXT,
    "createdSystemId" TEXT,
    "createdEventIds" JSONB,
    "createdReviewIds" JSONB,
    "importedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegacyImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegacyImportBatch_organizationId_fileHash_key" ON "LegacyImportBatch"("organizationId", "fileHash");
CREATE INDEX "LegacyImportBatch_organizationId_createdAt_idx" ON "LegacyImportBatch"("organizationId", "createdAt");
CREATE INDEX "LegacyImportRow_sourceKey_idx" ON "LegacyImportRow"("sourceKey");
CREATE UNIQUE INDEX "LegacyImportRow_batchId_worksheetName_sourceRow_key" ON "LegacyImportRow"("batchId", "worksheetName", "sourceRow");
CREATE INDEX "LegacyImportRow_batchId_status_idx" ON "LegacyImportRow"("batchId", "status");

ALTER TABLE "LegacyImportBatch" ADD CONSTRAINT "LegacyImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegacyImportBatch" ADD CONSTRAINT "LegacyImportBatch_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegacyImportRow" ADD CONSTRAINT "LegacyImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LegacyImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
