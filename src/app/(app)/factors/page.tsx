import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, isOwner } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { FactorForm, type ContactOption } from "./factor-form";
import { FactorsBrowser, type FactorLite, type SalesPerson } from "./factors-browser";
import { FactorNumberSetting } from "./factor-number-setting";
import { createFactor } from "@/lib/actions/factors";
import { OWNER_ONLY_STATES, isPreFactor, getNextFactorNumber } from "@/lib/factor";
import { factorPayable } from "@/lib/factor-total";
import { formatNumber, formatDate } from "@/lib/format";

/** Tehran-local YYYY-MM-DD, for grouping factors by the day they were created. */
function tehranDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export default async function FactorsPage() {
  const user = await requireUser();
  const isManager = canManageUsers(user.role);
  const owner = isOwner(user.role);
  const nextNumber = owner ? await getNextFactorNumber() : 0;

  const [factors, users, contacts] = await Promise.all([
    prisma.factor.findMany({
      // Members only ever see pre-factor states; owner+admin see everything.
      where: isManager ? {} : { state: { notIn: OWNER_ONLY_STATES } },
      orderBy: [{ createdAt: "desc" }],
      include: {
        items: { select: { quantity: true, unitPrice: true } },
        creator: { select: { id: true, name: true, avatarColor: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: "asc" },
    }),
    prisma.contact.findMany({
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        factorName: true,
        phone: true,
        notes: true,
        economicCode: true,
        nationalId: true,
        registrationNumber: true,
        postalCode: true,
      },
    }),
  ]);

  const contactOptions: ContactOption[] = contacts.map((c) => ({
    id: c.id,
    name: c.factorName?.trim() || `${c.firstName} ${c.lastName}`.trim(),
    phone: c.phone ?? "",
    address: c.notes ?? "",
    economicCode: c.economicCode ?? "",
    nationalId: c.nationalId ?? "",
    registrationNumber: c.registrationNumber ?? "",
    postalCode: c.postalCode ?? "",
  }));

  const factorsLite: FactorLite[] = factors.map((f) => ({
    id: f.id,
    number: f.number,
    state: f.state,
    paymentKind: f.paymentKind,
    isPre: isPreFactor(f.state) || f.state === "CANCELED",
    buyerName: f.buyerName,
    payable: Math.round(factorPayable(f)),
    dayKey: tehranDayKey(f.createdAt),
    dayLabel: formatDate(f.createdAt),
    creatorId: f.creatorId,
  }));

  const salespeople: SalesPerson[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    avatarColor: u.avatarColor,
  }));

  return (
    <div>
      <PageHeader
        title="فاکتورها"
        subtitle={`${formatNumber(factors.length)} فاکتور`}
        action={<FactorForm action={createFactor} contacts={contactOptions} />}
      />

      <div className="space-y-4 p-4 sm:p-6">
        {owner && <FactorNumberSetting current={nextNumber} />}
        <FactorsBrowser factors={factorsLite} salespeople={salespeople} />
      </div>
    </div>
  );
}
