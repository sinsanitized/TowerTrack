ALTER TABLE "ServiceEvent"
ADD CONSTRAINT "ServiceEvent_recordedById_fkey"
FOREIGN KEY ("recordedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ServiceEvent_recordedById_idx" ON "ServiceEvent"("recordedById");
CREATE INDEX "AuditLog_changedById_changedAt_idx" ON "AuditLog"("changedById", "changedAt");
