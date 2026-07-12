import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone, Building2, Briefcase, FileText, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { SenfPill } from "@/components/ui/badge";
import { StateBadge } from "@/components/ui/factor-badge";
import { formatNumber, formatDate, toFa } from "@/lib/format";
import { factorPayable } from "@/lib/factor-total";
import { OWNER_ONLY_STATES, isPreFactor } from "@/lib/factor";
import { FactorForm, type FactorInitial, SELLER_DEFAULTS } from "../../factors/factor-form";
import { createFactor } from "@/lib/actions/factors";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isManager = canManageUsers(user.role);

  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      company: true,
      owner: { select: { name: true, avatarColor: true } },
      factors: {
        // Members only see pre-factor states; managers see everything.
        where: isManager ? {} : { state: { notIn: OWNER_ONLY_STATES } },
        orderBy: { createdAt: "desc" },
        include: { items: { select: { quantity: true, unitPrice: true } } },
      },
    },
  });

  if (!contact) notFound();

  const fullName = `${contact.firstName} ${contact.lastName}`.trim();
  const factorName = contact.factorName?.trim();

  const idFields = [
    ["شناسه/کد ملی", contact.nationalId],
    ["شماره اقتصادی", contact.economicCode],
    ["کد پستی", contact.postalCode],
    ["شماره ثبت", contact.registrationNumber],
  ].filter(([, v]) => v);

  const factorInitial: FactorInitial = {
    buyerName: factorName || fullName,
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + company */}
        <div className="space-y-4">
          <div className="panel p-5">
            <div className="flex items-start gap-4">
              <Avatar name={fullName} color={contact.owner.avatarColor} size={56} />
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight">{fullName}</h1>
                {factorName && factorName !== fullName && (
                  <p className="mt-0.5 text-sm">
                    <span className="text-muted">نام روی فاکتور: </span>
                    <span className="font-medium">{factorName}</span>
                  </p>
                )}
                {contact.senf && (
                  <div className="mt-2">
                    <SenfPill senf={contact.senf} />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
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
                    className="truncate font-medium transition-colors hover:text-[var(--brand)]"
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

            {idFields.length > 0 && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border pt-4 text-xs">
                {idFields.map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-faint">{k}</dt>
                    <dd className="tabular-nums" dir="ltr" style={{ textAlign: "right" }}>
                      {toFa(String(v))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {contact.notes && (
              <div className="mt-4 rounded-e-lg border-s-2 border-[color:var(--gold-hair)] bg-surface-2 p-3 text-sm text-muted [overflow-wrap:anywhere]">
                <span className="mb-1 block text-xs font-medium text-faint">آدرس</span>
                {contact.notes}
              </div>
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
                {formatNumber(contact.factors.length)} مورد
              </span>
            </div>

            {contact.factors.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-14 text-center text-sm text-muted">
                <Inbox size={26} className="text-faint" aria-hidden="true" />
                هنوز فاکتوری برای این مخاطب ثبت نشده است.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {contact.factors.map((f) => (
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
