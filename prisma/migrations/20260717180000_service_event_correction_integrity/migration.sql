-- A recorded event can have only one direct corrective replacement.
-- This makes concurrent correction attempts fail safely at the database boundary.
CREATE UNIQUE INDEX "ServiceEvent_correctedFromEventId_key"
ON "ServiceEvent"("correctedFromEventId");
