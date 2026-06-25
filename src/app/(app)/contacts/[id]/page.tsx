import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Mail, Phone, Building2, Briefcase } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { StageBadge } from "@/components/ui/badge";
import { LogActivity } from "@/components/log-activity";
import { ActivityTimeline } from "@/components/activity-timeline";
import { formatToman } from "@/lib/format";

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
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, avatarColor: true } } },
      },
    },
  });

  if (!contact) notFound();

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowRight size={16} /> بازگشت به مخاطبین
      </Link>

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

            <dl className="mt-5 space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-muted" />
                  <a href={`mailto:${contact.email}`} className="hover:text-[var(--brand)]">
                    {contact.email}
                  </a>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-muted" />
                  {contact.phone}
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
              <div className="flex items-center gap-2">
                <Briefcase size={15} className="text-muted" />
                مسئول: {contact.owner.name}
              </div>
            </dl>

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
