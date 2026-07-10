import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, User, Briefcase, CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { StageBadge } from "@/components/ui/badge";
import { InvoiceBuilder } from "@/components/invoice/invoice-builder";
import { formatToman, formatDate, formatPercent } from "@/lib/format";

const SELLER_NAME = "اسپان هلدینگ";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      company: { select: { name: true, phone: true, address: true } },
      contact: { select: { firstName: true, lastName: true, phone: true } },
      owner: { select: { name: true } },
    },
  });

  if (!deal) notFound();

  const now = new Date();
  const jParts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const jy = jParts.find((p) => p.type === "year")?.value ?? "";
  const jm = jParts.find((p) => p.type === "month")?.value ?? "";
  const jd = jParts.find((p) => p.type === "day")?.value ?? "";
  const defaultInvoiceNo = `${jy}${jm}${jd}-${deal.id.slice(-4).toUpperCase()}`;
  const defaultDate = new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);

  const buyer = deal.company
    ? { name: deal.company.name, phone: deal.company.phone, address: deal.company.address }
    : deal.contact
      ? { name: `${deal.contact.firstName} ${deal.contact.lastName}`, phone: deal.contact.phone, address: null }
      : { name: "", phone: null, address: null };

  const customerLine = [
    deal.company?.name,
    deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/deals"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowRight size={16} /> بازگشت به معاملات
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Deal summary */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-lg font-bold tracking-tight">{deal.title}</h1>
              <StageBadge stage={deal.stage} />
            </div>
            <div className="mt-4 text-2xl font-bold text-[color:var(--gold-ink)]">
              {formatToman(Number(deal.value))}
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-2.5">
                <Briefcase size={15} className="shrink-0 text-faint" aria-hidden="true" />
                <span className="text-muted">احتمال موفقیت</span>
                <span className="ms-auto font-medium">{formatPercent(deal.probability)}</span>
              </div>
              {deal.company && (
                <div className="flex items-center gap-2.5">
                  <Building2 size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">{deal.company.name}</span>
                </div>
              )}
              {deal.contact && (
                <div className="flex items-center gap-2.5">
                  <User size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">
                    {deal.contact.firstName} {deal.contact.lastName}
                  </span>
                </div>
              )}
              {deal.expectedCloseDate && (
                <div className="flex items-center gap-2.5">
                  <CalendarDays size={15} className="shrink-0 text-faint" aria-hidden="true" />
                  <span className="text-muted">تاریخ بستن</span>
                  <span className="ms-auto font-medium">{formatDate(deal.expectedCloseDate)}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Briefcase size={15} className="shrink-0 text-faint" aria-hidden="true" />
                <span className="text-muted">مسئول</span>
                <span className="ms-auto font-medium">{deal.owner.name}</span>
              </div>
            </div>

            {deal.notes && (
              <p className="mt-4 whitespace-pre-line rounded-lg border-s-2 border-[color:var(--gold-hair)] bg-surface-2 p-3 text-sm leading-relaxed text-muted">
                {deal.notes}
              </p>
            )}
          </div>
        </div>

        {/* Invoice builder */}
        <div className="lg:col-span-2">
          <InvoiceBuilder
            sellerName={SELLER_NAME}
            buyer={buyer}
            defaultItem={{ desc: deal.title, price: Number(deal.value) }}
            defaultDate={defaultDate}
            defaultInvoiceNo={defaultInvoiceNo}
          />
          {customerLine && (
            <p className="mt-2 px-1 text-xs text-muted">مشتری: {customerLine}</p>
          )}
        </div>
      </div>
    </div>
  );
}
