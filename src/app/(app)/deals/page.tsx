import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { formatToman, formatNumber } from "@/lib/format";
import { DealForm } from "./deal-form";
import { KanbanBoard, type DealCard } from "./kanban-board";
import {
  createDeal,
  updateDeal,
  deleteDeal,
  moveDealStage,
} from "@/lib/actions/deals";

function toDateInput(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; owner?: string }>;
}) {
  const { q, company, owner } = await searchParams;

  const and: Prisma.DealWhereInput[] = [];
  if (q) and.push({ title: { contains: q, mode: "insensitive" } });
  if (company) and.push({ companyId: company });
  if (owner) and.push({ ownerId: owner });
  const where: Prisma.DealWhereInput = and.length ? { AND: and } : {};

  const [deals, companies, contacts, users] = await Promise.all([
    prisma.deal.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        owner: { select: { name: true, avatarColor: true } },
      },
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const contactOptions = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
  }));

  const cards: DealCard[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    value: Number(d.value),
    currency: d.currency,
    stage: d.stage,
    probability: d.probability,
    companyName: d.company?.name ?? null,
    contactName: d.contact
      ? `${d.contact.firstName} ${d.contact.lastName}`
      : null,
    ownerName: d.owner.name,
    ownerColor: d.owner.avatarColor,
    editValues: {
      title: d.title,
      value: Number(d.value),
      stage: d.stage,
      probability: d.probability,
      companyId: d.companyId,
      contactId: d.contactId,
      expectedCloseDate: toDateInput(d.expectedCloseDate),
      notes: d.notes,
      source: d.source,
    },
  }));

  const openValue = deals
    .filter((d) => d.status === "OPEN")
    .reduce((s, d) => s + Number(d.value), 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="معاملات"
        subtitle={`${formatNumber(deals.length)} معامله · ${formatToman(openValue)} معاملات باز`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="جستجوی عنوان معامله…" />
            <SelectFilter
              param="company"
              allLabel="همهٔ شرکت‌ها"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectFilter
              param="owner"
              allLabel="همهٔ مسئول‌ها"
              options={users.map((u) => ({ value: u.id, label: u.name }))}
            />
            <DealForm
              mode="create"
              action={createDeal}
              companies={companies}
              contacts={contactOptions}
            />
          </div>
        }
      />
      <KanbanBoard
        key={`${q ?? ""}|${company ?? ""}|${owner ?? ""}`}
        initialDeals={cards}
        companies={companies}
        contacts={contactOptions}
        moveDeal={moveDealStage}
        updateDeal={updateDeal}
        deleteDeal={deleteDeal}
      />
    </div>
  );
}
