// Cron-triggered end-of-month close: on the 1st of a new Jalali month, back up
// the month that just ended and purge its live factors + attendance. Idempotent
// (skips a month already archived) and never touches the current month.
// Guarded by the same x-cron-secret as the other cron jobs.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { recentMonths } from "@/lib/attendance-report";
import { closeMonth, sweepFinishedInClosedMonths } from "@/lib/monthly-backup";
import { purgeOldChatMessages } from "@/lib/chat-retention";

export const dynamic = "force-dynamic";

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

  // recentMonths(2) = [current, previous]. Close the previous one; closeMonth
  // itself guards against the current month and against double-closing.
  const previous = recentMonths(2)[1];
  const result = await closeMonth(previous);
  // Reclaim any factors that finished AFTER their month was already archived.
  const sweptLeftovers = await sweepFinishedInClosedMonths();
  // Storage control: permanently delete chat messages (+ their files) older
  // than the retention window.
  const chat = await purgeOldChatMessages(new Date());
  return NextResponse.json({
    ...result,
    sweptLeftovers,
    purgedChatMessages: chat.messages,
    purgedChatFiles: chat.files,
  });
}
