// Cron-triggered endpoint: permanently delete accounts that have been
// DEACTIVATED longer than the grace window (PURGE_DEACTIVATED_DAYS, default 30).
// Their owned records (contacts, deals, companies, tasks, messages, channels,
// reminders, activities) are reassigned to the owner first, so nothing is lost.
// Owners are never purged. Guarded by the same x-cron-secret as the SMS cron.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GRACE_DAYS = Number(process.env.PURGE_DEACTIVATED_DAYS ?? "30");
const MAX_BATCH = 100;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A non-positive window disables auto-purge entirely.
  if (!Number.isFinite(GRACE_DAYS) || GRACE_DAYS <= 0) {
    return NextResponse.json({ purged: 0, disabled: true });
  }

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);

  const admin = await prisma.user.findFirst({
    where: { role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) return NextResponse.json({ purged: 0, error: "no active owner" });

  const stale = await prisma.user.findMany({
    where: {
      isActive: false,
      role: { not: "OWNER" },
      deactivatedAt: { not: null, lte: cutoff },
    },
    select: { id: true },
    take: MAX_BATCH,
  });

  let purged = 0;
  for (const u of stale) {
    try {
      await prisma.$transaction([
        prisma.company.updateMany({ where: { ownerId: u.id }, data: { ownerId: admin.id } }),
        prisma.contact.updateMany({ where: { ownerId: u.id }, data: { ownerId: admin.id } }),
        prisma.deal.updateMany({ where: { ownerId: u.id }, data: { ownerId: admin.id } }),
        prisma.activity.updateMany({ where: { userId: u.id }, data: { userId: admin.id } }),
        prisma.task.updateMany({ where: { assigneeId: u.id }, data: { assigneeId: admin.id } }),
        prisma.message.updateMany({ where: { senderId: u.id }, data: { senderId: admin.id } }),
        prisma.channel.updateMany({ where: { createdById: u.id }, data: { createdById: admin.id } }),
        prisma.reminder.updateMany({ where: { createdById: u.id }, data: { createdById: admin.id } }),
        prisma.channelMember.deleteMany({ where: { userId: u.id } }),
        prisma.user.delete({ where: { id: u.id } }),
      ]);
      purged += 1;
    } catch {
      /* skip a user that couldn't be purged; the next run retries */
    }
  }

  return NextResponse.json({ purged, candidates: stale.length, graceDays: GRACE_DAYS });
}
