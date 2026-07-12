import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovedSessionUser, isOwner } from "@/lib/rbac";
import { normalizeMonth } from "@/lib/attendance-report";
import { buildMonthArchive } from "@/lib/monthly-backup";

export const dynamic = "force-dynamic";

/**
 * Owner-only monthly backup download. Returns a complete JSON snapshot of the
 * requested Jalali month (per-user work-hours + paid-factor counts, plus the
 * underlying attendance log and paid-factor list) as a file attachment.
 */
export async function GET(req: Request) {
  const user = await getApprovedSessionUser();
  if (!user || !isOwner(user.role)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
  }

  const url = new URL(req.url);
  const month = normalizeMonth(url.searchParams.get("month") ?? undefined);

  // A closed month lives only in the archive (its live rows were purged), so
  // serve the stored snapshot; otherwise build it live.
  const archived = await prisma.monthlyArchive.findUnique({ where: { month } });
  const backup = archived ? archived.payload : await buildMonthArchive(month);

  const body = JSON.stringify(backup, null, 2);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${month}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
