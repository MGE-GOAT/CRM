import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { SourceCheck } from "../source-check";
import { StateBadge } from "@/components/ui/factor-badge";
import { SOURCE_LABEL } from "@/lib/factor";
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

  const factor = await prisma.factor.findUnique({
    where: { id },
    include: {
      items: { select: { quantity: true, unitPrice: true } },
      sources: { orderBy: { source: "asc" } },
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
        </div>
        <div className="divide-y divide-border">
          {factor.sources.map((s) => (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <span className="font-medium">{SOURCE_LABEL[s.source]}</span>
                {s.checkedAt && (
                  <span className="ms-2 text-xs text-muted">
                    {formatDateTime(s.checkedAt)}
                  </span>
                )}
              </div>
              <SourceCheck entryId={s.id} checked={s.checked} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
