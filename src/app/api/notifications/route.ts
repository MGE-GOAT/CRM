import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApprovedSessionUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const FEED_LIMIT = 20;

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

export async function GET() {
  const user = await getApprovedSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await materializeDueReminders(user.id);

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
      take: FEED_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        createdAt: true,
        read: true,
      },
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return NextResponse.json({ unread, items });
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

  return NextResponse.json({ ok: true });
}
