-- Speed up the paginated contacts list (sorted by createdAt) and the صنف filter.
CREATE INDEX IF NOT EXISTS "Contact_createdAt_idx" ON "Contact"("createdAt");
CREATE INDEX IF NOT EXISTS "Contact_senf_idx" ON "Contact"("senf");
