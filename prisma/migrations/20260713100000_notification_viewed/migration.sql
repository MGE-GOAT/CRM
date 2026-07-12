-- Add `viewed` to decouple the per-section sidebar badge (cleared on visiting
-- the page) from `read` (acknowledged via «مشاهده شد»).
ALTER TABLE "Notification" ADD COLUMN "viewed" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: already-acknowledged notifications must not resurface as unseen
-- section badges after the deploy.
UPDATE "Notification" SET "viewed" = true WHERE "read" = true;

CREATE INDEX "Notification_userId_viewed_idx" ON "Notification" ("userId", "viewed");
