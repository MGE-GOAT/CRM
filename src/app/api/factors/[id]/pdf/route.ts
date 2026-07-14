import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApprovedSessionUser, canManageUsers } from "@/lib/rbac";
import { renderFactorPdf } from "@/lib/factor-pdf";
import { toInvoiceFactor } from "@/lib/factor-to-invoice";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Per-factor PDF (for sharing/downloading out of the app). Same view-permission
 * as the factor detail page: managers see any; members only their pre-factors
 * (not PAID/SENDING/EXIT). Per-source CHILD factors are manager-only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getApprovedSessionUser();
  if (!user) return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });

  const factor = await prisma.factor.findUnique({
    where: { id },
    include: { items: { orderBy: { row: "asc" } } },
  });
  if (!factor) return NextResponse.json({ error: "فاکتور یافت نشد." }, { status: 404 });

  const manager = canManageUsers(user.role);
  if (!manager && (factor.parentFactorId || ["PAID", "SENDING", "EXIT"].includes(factor.state))) {
    return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 403 });
  }

  try {
    const pdf = await renderFactorPdf(toInvoiceFactor(factor));
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="factor-${factor.number}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا در ساخت PDF";
    return NextResponse.json({ error: `ساخت PDF ناموفق بود: ${msg}` }, { status: 500 });
  }
}
