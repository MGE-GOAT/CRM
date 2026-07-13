import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/storage";

/** Chat messages older than this many months are permanently deleted monthly. */
export const CHAT_RETENTION_MONTHS = 3;

/**
 * Permanently delete chat messages (and their uploaded files) older than the
 * retention window — the monthly storage-control job.
 *
 * Safe by construction:
 *  - Attachment rows cascade on message delete (FK onDelete: Cascade); we grab
 *    their storageKeys FIRST, then reclaim the bytes from disk after.
 *  - A newer message that replied to a deleted one keeps existing — its
 *    replyToId is SET NULL by the FK (it just loses the quoted preview).
 *
 * `now` is passed in (not read internally) so the caller controls the clock and
 * the function stays deterministic/testable. Idempotent.
 */
export async function purgeOldChatMessages(now: Date): Promise<{ messages: number; files: number }> {
  // Subtract months WITHOUT day-rollover drift: naive setMonth on e.g. May 31
  // lands on Mar 3 (Feb has no 31st), which would delete Mar 1-2 early. Clamp
  // the day to the target month's length instead.
  const cutoff = new Date(now);
  const day = cutoff.getDate();
  cutoff.setDate(1);
  cutoff.setMonth(cutoff.getMonth() - CHAT_RETENTION_MONTHS);
  const lastDayOfTargetMonth = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
  cutoff.setDate(Math.min(day, lastDayOfTargetMonth));

  // Collect the on-disk files of the doomed messages BEFORE deleting the rows
  // (the attachment rows disappear via cascade once the messages are gone).
  const files = await prisma.attachment.findMany({
    where: { message: { createdAt: { lt: cutoff } } },
    select: { storageKey: true },
  });

  const del = await prisma.message.deleteMany({ where: { createdAt: { lt: cutoff } } });

  // Best-effort disk reclaim — a missing file is fine (already gone).
  await Promise.all(files.map((f) => deleteUpload(f.storageKey)));

  return { messages: del.count, files: files.length };
}
