import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovedSessionUser, isOwner } from "@/lib/rbac";
import { normalizeMonth } from "@/lib/attendance-report";
import { buildMonthArchive } from "@/lib/monthly-backup";
import { buildBackupZip } from "@/lib/factor-pdf";
import type { InvoiceFactor } from "@/lib/factor-invoice-html";

export const dynamic = "force-dynamic";
// Rendering N invoices with headless chromium can take a while for a big month.
export const maxDuration = 300;

/**
 * Owner-only PDF backup: a ZIP containing the month's JSON snapshot plus one A4
 * PDF per factor. Serves a closed month from its stored archive; otherwise
 * builds it live.
 */
export async function GET(req: Request) {
  const user = await getApprovedSessionUser();
  if (!user || !isOwner(user.role)) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
  }

  const url = new URL(req.url);
  const month = normalizeMonth(url.searchParams.get("month") ?? undefined);

  const archived = await prisma.monthlyArchive.findUnique({ where: { month } });
  const payload = archived
    ? (archived.payload as Record<string, unknown>)
    : ((await buildMonthArchive(month)) as unknown as Record<string, unknown>);

  const factors = (payload.allFactors ?? []) as InvoiceFactor[];

  try {
    const zip = await buildBackupZip(month, payload, factors);
    return new NextResponse(zip as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="backup-${month}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    // Chromium missing/misconfigured shouldn't 500 opaquely — the JSON backup
    // still works via /api/reports/backup.
    const msg = e instanceof Error ? e.message : "خطا در ساخت PDF";
    return NextResponse.json(
      { error: `ساخت بکاپ PDF ناموفق بود: ${msg}` },
      { status: 500 },
    );
  }
}
