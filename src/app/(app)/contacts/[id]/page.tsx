import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Phone, Building2, Briefcase, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { StageBadge } from "@/components/ui/badge";
import { LogActivity } from "@/components/log-activity";
import { ActivityTimeline } from "@/components/activity-timeline";
import { formatToman, formatNumber, formatDate, toFa } from "@/lib/format";
import { priorityLabel } from "@/lib/labels";

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
    { label: "درآمد موفق", value: formatToman(wonValue) },
    { label: "وظایف باز", value: formatNumber(openTasks) },
  ];

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowRight size={16} /> بازگشت به مخاطبین
      </Link>

      {/* 360° summary */}
      <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-3 text-center sm:p-4">
            <div className="text-sm font-bold leading-tight tabular-nums sm:text-xl">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <Avatar
                name={`${contact.firstName} ${contact.lastName}`}
                color={contact.owner.avatarColor}
                size={52}
              />
              <div>
                <h1 className="text-lg font-bold">
                  {contact.firstName} {contact.lastName}
                </h1>
                {contact.title && (
                  <p className="text-sm text-muted">{contact.title}</p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-muted" />
                  <a dir="ltr" href={`mailto:${contact.email}`} className="hover:text-[var(--brand)]">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-muted" />
                  <span dir="ltr">{toFa(contact.phone)}</span>
                </div>
              )}
              {contact.company && (
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-muted" />
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="hover:text-[var(--brand)]"
                  >
                    {contact.company.name}
                  </Link>
                </div>
              )}
              {contact.senf && (
                <div className="flex items-center gap-2">
                  <Tag size={15} className="text-muted" />
                  صنف: {contact.senf}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Briefcase size={15} className="text-muted" />
                مسئول: {contact.owner.name}
              </div>
            </div>

            {contact.notes && (
              <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-muted">
                {contact.notes}
              </div>
            )}
          </div>

          {/* Related deals */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">معاملات</h2>
            {contact.deals.length === 0 ? (
              <p className="text-sm text-muted">هنوز معامله‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {contact.deals.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm"
                  >
                    <span className="font-medium">{d.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted">
                        {formatToman(Number(d.value))}
                      </span>
                      <StageBadge stage={d.stage} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tasks */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">وظایف</h2>
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
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">یادآوری‌ها</h2>
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
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">تاریخچه فعالیت‌ها</h2>
            <ActivityTimeline activities={contact.activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
