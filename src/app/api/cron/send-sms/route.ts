// Cron-triggered endpoint: sends SMS for due reminders (action = SMS).
// Called every minute by a host cron with the x-cron-secret header.
// Auto-sends a reminder's message to its contact at the reminder time.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";

export const dynamic = "force-dynamic";

// Only fire for reminders due within this window, so an outage doesn't later
// blast a backlog of long-past reminders.
const WINDOW_MS = 6 * 60 * 60 * 1000;
const MAX_BATCH = 50;

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type Outcome = "sent" | "failed" | "skipped";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);

  const due = await prisma.reminder.findMany({
    where: {
      action: "SMS",
      smsStatus: null, // not yet processed
      date: { lte: now, gte: windowStart },
      contactId: { not: null },
      messageBody: { not: null },
    },
    take: MAX_BATCH,
    include: { contact: { select: { phone: true } } },
  });

  async function processOne(r: (typeof due)[number]): Promise<Outcome> {
    const phone = r.contact?.phone;
    const text = r.messageBody;
    if (!phone || !text) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { smsStatus: "skipped", smsError: "شمارهٔ مخاطب یا متن پیام موجود نیست" },
      });
      return "skipped";
    }
    const result = await sendSms(phone, text);
    if (result.ok) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { smsStatus: "sent", smsSentAt: new Date() },
      });
      return "sent";
    }
    await prisma.reminder.update({
      where: { id: r.id },
      data: { smsStatus: "failed", smsError: result.error.slice(0, 300) },
    });
    return "failed";
  }

  // Fan out so one slow SMS can't stall the whole batch.
  const results = await Promise.allSettled(due.map((r) => processOne(r)));
  const tally = { sent: 0, failed: 0, skipped: 0 };
  for (const res of results) {
    if (res.status === "fulfilled") tally[res.value] += 1;
    else tally.failed += 1;
  }

  return NextResponse.json({ processed: due.length, ...tally });
}
