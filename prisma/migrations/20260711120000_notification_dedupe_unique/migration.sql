-- Dedupe key for materialized notifications (one REMINDER per reminder per user).
-- NULL sourceId rows (MESSAGE/TASK) stay unconstrained (Postgres NULLs distinct).
CREATE UNIQUE INDEX "Notification_userId_type_sourceId_key" ON "Notification"("userId", "type", "sourceId");
