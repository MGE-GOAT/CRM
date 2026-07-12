import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApprovedSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * Lazily materialize REMINDER notifications for reminders that have become due
 * and are visible to this user (public, or created by them). Deduped on
 * (type, userId, sourceId=reminderId) so each due reminder notifies once.
 */
async function materializeDueReminders(userId: string) {
  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: {
      date: { lte: now },
      done: false,
      OR: [{ isPublic: true }, { createdById: userId }],
    },
    select: { id: true, title: true },
    orderBy: { date: "desc" },
    take: 50,
  });
  if (due.length === 0) return;

  const existing = await prisma.notification.findMany({
    where: {
      userId,
      type: "REMINDER",
      sourceId: { in: due.map((r) => r.id) },
    },
    select: { sourceId: true },
  });
  const seen = new Set(existing.map((e) => e.sourceId));
  const fresh = due.filter((r) => !seen.has(r.id));
  if (fresh.length === 0) return;

  // skipDuplicates + the @@unique([userId,type,sourceId]) guard make concurrent
  // polls idempotent — no duplicate reminder notifications.
  await prisma.notification.createMany({
    data: fresh.map((r) => ({
      userId,
      type: "REMINDER" as const,
      title: "یادآوری",
      body: r.title,
      href: "/calendar",
      sourceId: r.id,
    })),
    skipDuplicates: true,
  });
}

// Cap on retained, already-seen ("archived") notifications per user. When a
// user acknowledges more, the oldest seen ones are pruned.
const ARCHIVE_LIMIT = 30;

const NOTIF_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  href: true,
  createdAt: true,
  read: true,
} as const;

export async function GET() {
  const user = await getApprovedSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await materializeDueReminders(user.id);

  // active = not yet acknowledged (shown as persistent cards + drive the 5/10
  // thresholds). archived = acknowledged history shown in the bell (max 30).
  const [active, archived, activeCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, read: false },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: NOTIF_SELECT,
    }),
    prisma.notification.findMany({
      where: { userId: user.id, read: true },
      orderBy: { createdAt: "desc" },
      take: ARCHIVE_LIMIT,
      select: NOTIF_SELECT,
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ activeCount, active, archived });
}

const postSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.boolean().optional(),
});

export async function POST(req: Request) {
  const user = await getApprovedSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let parsed: z.infer<typeof postSchema>;
  try {
    parsed = postSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Acknowledge ("مشاهده شد"): move the selected (or all) active notifs into the
  // seen archive.
  if (parsed.all) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  } else if (parsed.ids && parsed.ids.length > 0) {
    await prisma.notification.updateMany({
      where: { userId: user.id, id: { in: parsed.ids } },
      data: { read: true },
    });
  }

  // Keep only the newest ARCHIVE_LIMIT seen notifs; prune the oldest.
  const keep = await prisma.notification.findMany({
    where: { userId: user.id, read: true },
    orderBy: { createdAt: "desc" },
    skip: ARCHIVE_LIMIT,
    take: 200,
    select: { id: true },
  });
  if (keep.length > 0) {
    await prisma.notification.deleteMany({
      where: { userId: user.id, id: { in: keep.map((n) => n.id) } },
    });
  }

  return NextResponse.json({ ok: true });
}
