import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, isOwner } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { SourceManager } from "../source-manager";
import { ensureSourceOptions } from "@/lib/factor";
import { SOURCE_KEYS } from "@/lib/factor";
import { formatNumber, formatDate, toFa } from "@/lib/format";
import { factorPayable } from "@/lib/factor-total";
import type { SourceKind } from "@prisma/client";
import { AutoRefresh } from "@/components/chat/auto-refresh";

export default async function SentFactorsPage() {
  const user = await requireUser();
  if (!canManageUsers(user.role)) redirect("/factors");

  await ensureSourceOptions();

  const [factors, options] = await Promise.all([
    prisma.factor.findMany({
      // Top-level sent factors only — child (per-source) factors are shown
      // inside each ارسالی, never as their own row here.
      where: { parentFactorId: null, state: { in: ["SENDING", "EXIT"] } },
      orderBy: [{ sentAt: "desc" }],
      include: {
        items: { select: { quantity: true, unitPrice: true } },
        sources: { select: { checked: true } },
      },
    }),
    prisma.factorSourceOption.findMany(),
  ]);

  const sourceStates = SOURCE_KEYS.map((key) => ({
    key: key as SourceKind,
    enabled: options.find((o) => o.key === key)?.enabled ?? false,
  }));

  const inProgress = factors.filter((f) => f.state === "SENDING");
  const archived = factors.filter((f) => f.state === "EXIT");

  const row = (f: (typeof factors)[number]) => {
    const total = f.sources.length;
    const done = f.sources.filter((s) => s.checked).length;
    const isArchived = f.state === "EXIT";
    return (
      <Link
        key={f.id}
        href={`/factors/sent/${f.id}`}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          <span className="font-medium">{f.buyerName}</span>
          <span className="text-muted tabular-nums">#{toFa(f.number)}</span>
        </span>
        <span className="flex items-center gap-3 text-muted">
          <span className="tabular-nums">
            {toFa(done)} از {toFa(total)} منبع ارسال شد
          </span>
          <span className="font-medium tabular-nums text-text">
            {formatNumber(factorPayable(f))} ریال
          </span>
          <span>{formatDate(f.sentAt ?? f.createdAt)}</span>
          {isArchived ? (
            <Badge color="#047857">آرشیو</Badge>
          ) : (
            <Badge color="#0369a1">در حال انجام</Badge>
          )}
        </span>
      </Link>
    );
  };

  return (
    <div>
      <AutoRefresh interval={20000} />
      <PageHeader title="ارسالی‌ها" subtitle={`${formatNumber(factors.length)} مورد`} />

      <div className="space-y-5 p-4 sm:p-6">
        {isOwner(user.role) && <SourceManager sources={sourceStates} />}

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <div className="border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight">در حال انجام</h2>
          </div>
          <div className="divide-y divide-border">
            {inProgress.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted"><Inbox size={26} className="text-faint" aria-hidden="true" />موردی برای نمایش نیست.</div>
            ) : (
              inProgress.map(row)
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <div className="border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight">آرشیو‌شده‌ها</h2>
          </div>
          <div className="divide-y divide-border">
            {archived.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted"><Inbox size={26} className="text-faint" aria-hidden="true" />موردی برای نمایش نیست.</div>
            ) : (
              archived.map(row)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
