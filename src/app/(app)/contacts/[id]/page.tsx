import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Phone, Building2, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { StageBadge, SenfPill } from "@/components/ui/badge";
import { LogActivity } from "@/components/log-activity";
import { ActivityTimeline } from "@/components/activity-timeline";
import { formatRial, formatNumber, formatDate, toFa } from "@/lib/format";
import { priorityLabel } from "@/lib/labels";
import { FactorForm, type FactorInitial, SELLER_DEFAULTS } from "../../factors/factor-form";
import { createFactor } from "@/lib/actions/factors";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      company: true,
      owner: { select: { name: true, avatarColor: true } },
      deals: { orderBy: { createdAt: "desc" } },
      tasks: {
        orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
        include: { assignee: { select: { name: true, avatarColor: true } } },
      },
      reminders: { orderBy: { date: "desc" }, take: 10 },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, avatarColor: true } } },
      },
    },
  });

  if (!contact) notFound();

  // 360° summary
  const openDeals = contact.deals.filter((d) => d.status === "OPEN");
  const wonValue = contact.deals
    .filter((d) => d.status === "WON")
    .reduce((s, d) => s + Number(d.value), 0);
  const openTasks = contact.tasks.filter((t) => !t.completed).length;
  const summary = [
    { label: "معاملات باز", value: formatNumber(openDeals.length) },
    { label: "درآمد موفق", value: formatRial(wonValue) },
    { label: "وظایف باز", value: formatNumber(openTasks) },
  ];

  const factorInitial: FactorInitial = {
    buyerName: contact.factorName?.trim() || `${contact.firstName} ${contact.lastName}`.trim(),
    buyerPhone: contact.phone ?? "",
    buyerAddress: contact.notes ?? "",
    buyerEconomicCode: contact.economicCode ?? "",
    buyerNationalId: contact.nationalId ?? "",
    buyerRegistrationNumber: contact.registrationNumber ?? "",
    buyerPostalCode: contact.postalCode ?? "",
    contactId: contact.id,
    paymentKind: "",
    discount: "0",
    vat: "0",
    notes: "اعتبار پیش فاکتور درصورت واریز نقدی حداکثر ۴۸ ساعت می‌باشد",
    ...SELLER_DEFAULTS,
    items: [{ name: "", quantity: "1", unitPrice: "0", description: "" }],
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-[var(--brand)]"
        >
          <ArrowRight size={16} aria-hidden="true" /> بازگشت به مخاطبین
        </Link>
        <FactorForm action={createFactor} initial={factorInitial} />
      </div>

      {/* 360° summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {summary.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-surface p-4 text-center shadow-[var(--shadow-sm)]"
          >
            <div className="text-lg font-bold tracking-tight tabular-nums sm:text-2xl">
              {s.value}
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[var(--gold-mid)]"
                aria-hidden="true"
              />
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-start gap-4">
              <Avatar
                name={`${contact.firstName} ${contact.lastName}`}
                color={contact.owner.avatarColor}
                size={56}
              />
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight">
                  {contact.firstName} {contact.lastName}
                </h1>
                {contact.title && (
                  <p className="mt-0.5 text-sm text-muted">{contact.title}</p>
                )}
                {contact.senf && (
                  <div className="mt-2">
                    <SenfPill senf={contact.senf} />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <a
                    dir="ltr"
                    href={`mailto:${contact.email}`}
                    className="truncate transition-colors hover:text-[var(--brand)]"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <span dir="ltr" className="tabular-nums">{toFa(contact.phone)}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="truncate transition-colors hover:text-[var(--brand)]"
                  >
                    {contact.company.name}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Briefcase size={15} className="shrink-0 text-faint" aria-hidden="true" />
                <span className="text-muted">
                  مسئول: <span className="text-text">{contact.owner.name}</span>
                </span>
              </div>
            </div>

            {contact.notes && (
              <div className="mt-4 rounded-e-lg border-s-2 border-[color:var(--gold-hair)] bg-surface-2 p-3 text-sm text-muted [overflow-wrap:anywhere]">
                <span className="mb-1 block text-xs font-medium text-faint">آدرس</span>
                {contact.notes}
              </div>
            )}
          </div>

          {/* Related deals */}
          <div className="panel p-5">
            <h2 className="mb-3 font-bold tracking-tight">معاملات</h2>
            {contact.deals.length === 0 ? (
              <p className="text-sm text-muted">هنوز معامله‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {contact.deals.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="min-w-0 truncate font-medium">{d.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-muted">
                        {formatRial(Number(d.value))}
                      </span>
                      <StageBadge stage={d.stage} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tasks */}
          <div className="panel p-5">
            <h2 className="mb-3 font-bold tracking-tight">وظایف</h2>
            {contact.tasks.length === 0 ? (
              <p className="text-sm text-muted">وظیفه‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {contact.tasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className={t.completed ? "text-muted line-through" : "font-medium"}>
                      {t.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      {t.dueDate && <span>{formatDate(t.dueDate)}</span>}
                      <span>{priorityLabel[t.priority]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Reminders */}
          <div className="panel p-5">
            <h2 className="mb-3 font-bold tracking-tight">یادآوری‌ها</h2>
            {contact.reminders.length === 0 ? (
              <p className="text-sm text-muted">یادآوری‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {contact.reminders.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className={r.done ? "text-muted line-through" : "font-medium"}>
                      {r.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDate(r.date)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: activity */}
        <div className="space-y-4 lg:col-span-2">
          <LogActivity contactId={contact.id} />
          <div className="panel p-5">
            <h2 className="mb-4 font-bold tracking-tight">تاریخچه فعالیت‌ها</h2>
            <ActivityTimeline activities={contact.activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
