import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Globe, Phone, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/ui/avatar";
import { StageBadge } from "@/components/ui/badge";
import { LogActivity } from "@/components/log-activity";
import { ActivityTimeline } from "@/components/activity-timeline";
import { safeUrl } from "@/lib/utils";
import { formatToman } from "@/lib/format";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      contacts: { include: { owner: { select: { avatarColor: true } } } },
      deals: { orderBy: { createdAt: "desc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, avatarColor: true } } },
      },
    },
  });

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
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-5">
            <h1 className="text-lg font-bold">{company.name}</h1>
            <p className="text-sm text-muted">{company.industry ?? "—"}</p>

            <dl className="mt-5 space-y-3 text-sm">
              {safeUrl(company.website) && (
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-muted" />
                  <a
                    href={safeUrl(company.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--brand)]"
                  >
                    {company.website}
                  </a>
                </div>
              )}
              {company.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={15} className="text-muted" />
                  {company.phone}
                </div>
              )}
              {company.address && (
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-muted" />
                  {company.address}
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">مخاطبین</h2>
            {company.contacts.length === 0 ? (
              <p className="text-sm text-muted">هنوز مخاطبی ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {company.contacts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/contacts/${c.id}`}
                      className="flex items-center gap-2 rounded-lg p-1.5 text-sm hover:bg-gray-50"
                    >
                      <Avatar
                        name={`${c.firstName} ${c.lastName}`}
                        color={c.owner.avatarColor}
                        size={28}
                      />
                      <span>
                        {c.firstName} {c.lastName}
                        {c.title && (
                          <span className="block text-xs text-muted">{c.title}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">معاملات</h2>
            {company.deals.length === 0 ? (
              <p className="text-sm text-muted">هنوز معامله‌ای ثبت نشده است.</p>
            ) : (
              <ul className="space-y-2">
                {company.deals.map((d) => (
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

        <div className="space-y-4 lg:col-span-2">
          <LogActivity companyId={company.id} />
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 font-semibold">تاریخچه فعالیت‌ها</h2>
            <ActivityTimeline activities={company.activities} />
          </div>
        </div>
      </div>
    </div>
  );
}
