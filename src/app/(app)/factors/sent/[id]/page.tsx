import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { SourceCheck } from "../source-check";
import { StateBadge } from "@/components/ui/factor-badge";
import { SOURCE_LABEL, ensureSourceChildren } from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import { formatNumber, formatDateTime, toFa } from "@/lib/format";

export default async function SentFactorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  if (!canManageUsers(user.role)) redirect("/factors");

  // Make sure each source has its own editable/printable child factor.
  await ensureSourceChildren(id);

  const factor = await prisma.factor.findUnique({
    where: { id },
    include: {
      items: { select: { metrage: true, quantity: true, unitPrice: true } },
      sources: {
        orderBy: { source: "asc" },
        include: {
          child: { include: { items: { select: { metrage: true, quantity: true, unitPrice: true } } } },
        },
      },
    },
  });
  if (!factor) notFound();

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/factors/sent"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-[var(--brand)]"
      >
        <ArrowRight size={16} aria-hidden="true" /> بازگشت به ارسالی‌ها
      </Link>

      <div className="panel mb-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1">
              <StateBadge state={factor.state} />
            </div>
            <h1 className="text-lg font-bold tracking-tight">{factor.buyerName}</h1>
            <p className="text-sm text-muted">
              شماره <span className="tabular-nums">{toFa(factor.number)}</span> ·{" "}
              {formatNumber(factorPayable(factor))} ریال
            </p>
          </div>
          <Link
            href={`/factors/${factor.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
          >
            <FileText size={16} aria-hidden="true" /> مشاهده و چاپ فاکتور
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
        <div className="border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3">
          <h2 className="text-sm font-bold tracking-tight">منابع ارسال</h2>
          <p className="mt-0.5 text-xs text-muted">
            هر منبع فاکتور مجزای خود را دارد — برای ویرایش یا چاپ روی آن بزنید.
          </p>
        </div>
        <div className="divide-y divide-border">
          {factor.sources.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                {s.child ? (
                  <Link
                    href={`/factors/${s.child.id}`}
                    className="group inline-flex items-center gap-2"
                  >
                    <span className="font-medium group-hover:text-[var(--brand)] group-hover:underline">
                      {SOURCE_LABEL[s.source]}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      فاکتور #{toFa(s.child.number)} ·{" "}
                      {formatNumber(factorPayable(s.child))} ریال
                    </span>
                  </Link>
                ) : (
                  <span className="font-medium">{SOURCE_LABEL[s.source]}</span>
                )}
                {s.checkedAt && (
                  <span className="ms-2 text-xs text-muted">{formatDateTime(s.checkedAt)}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {s.child && (
                  <Link
                    href={`/factors/${s.child.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-surface-2"
                  >
                    <FileText size={14} aria-hidden="true" /> مشاهده و ویرایش
                  </Link>
                )}
                <SourceCheck entryId={s.id} checked={s.checked} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
