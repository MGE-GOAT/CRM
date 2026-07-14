import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, Globe, Phone, MapPin, Users, FileText, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { SenfPill } from "@/components/ui/badge";
import { StateBadge } from "@/components/ui/factor-badge";
import { safeUrl } from "@/lib/utils";
import { formatNumber, formatDate, toFa } from "@/lib/format";
import { factorPayable } from "@/lib/factor-total";
import { OWNER_ONLY_STATES, isPreFactor } from "@/lib/factor";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isManager = canManageUsers(user.role);

  const [company, factors] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: { contacts: { include: { owner: { select: { avatarColor: true } } } } },
    }),
    prisma.factor.findMany({
      where: {
        parentFactorId: null, // exclude per-source child factors
        contact: { companyId: id },
        ...(isManager ? {} : { state: { notIn: OWNER_ONLY_STATES } }),
      },
      orderBy: { createdAt: "desc" },
      include: { items: { select: { metrage: true, quantity: true, unitPrice: true } } },
    }),
  ]);

  if (!company) notFound();

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/companies"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowRight size={16} /> بازگشت به شرکت‌ها
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + contacts */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-[var(--brand)]">
                <Building2 size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight">{company.name}</h1>
                {company.industry && <p className="text-sm text-muted">{company.industry}</p>}
              </div>
            </div>
            {company.senf && (
              <div className="mt-3">
                <SenfPill senf={company.senf} />
              </div>
            )}

            <div className="mt-5 space-y-3 text-sm">
              {safeUrl(company.website) && (
                <div className="flex items-center gap-2">
                  <Globe size={15} className="shrink-0 text-muted" />
                  <a
                    dir="ltr"
                    href={safeUrl(company.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-[var(--brand)]"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="shrink-0 text-muted" />
                  <span dir="ltr">{toFa(company.phone)}</span>
                </div>
              )}
              {company.address && (
                <div className="flex items-start gap-2 [overflow-wrap:anywhere]">
                  <MapPin size={15} className="shrink-0 text-muted" />
                  {company.address}
                </div>
              )}
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="inline-flex items-center gap-2 font-bold tracking-tight">
                <Users size={16} className="text-[color:var(--gold-ink)]" aria-hidden="true" />
                مخاطبین
              </h2>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted">
                {formatNumber(company.contacts.length)} نفر
              </span>
            </div>
            {company.contacts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">هنوز مخاطبی ثبت نشده است.</p>
            ) : (
              <ul className="divide-y divide-border">
                {company.contacts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contacts/${c.id}`}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-[var(--gold-tint)]"
                    >
                      <Avatar
                        name={`${c.firstName} ${c.lastName}`}
                        color={c.owner.avatarColor}
                        size={28}
                      />
                      <span>
                        {c.firstName} {c.lastName}
                        {c.factorName && c.factorName.trim() !== `${c.firstName} ${c.lastName}`.trim() && (
                          <span className="block text-xs text-muted">{c.factorName}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: factors */}
        <div className="lg:col-span-2">
          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="inline-flex items-center gap-2 font-bold tracking-tight">
                <FileText size={16} className="text-[color:var(--gold-ink)]" aria-hidden="true" />
                فاکتورها
              </h2>
              <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted">
                {formatNumber(factors.length)} مورد
              </span>
            </div>
            {factors.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-muted">
                <Inbox size={26} className="text-faint" aria-hidden="true" />
                هنوز فاکتوری برای مخاطبان این شرکت ثبت نشده است.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {factors.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/factors/${f.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-surface-2"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium tabular-nums">
                          {isPreFactor(f.state) || f.state === "CANCELED" ? "پیش‌فاکتور" : "فاکتور"} #
                          {toFa(f.number)}
                        </span>
                        <span className="text-muted">{f.buyerName}</span>
                        <StateBadge state={f.state} />
                      </span>
                      <span className="flex items-center gap-3 text-muted">
                        <span>{formatDate(f.createdAt)}</span>
                        <span className="font-medium tabular-nums text-text">
                          {formatNumber(factorPayable(f))} ریال
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
