import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { CompanyForm } from "./company-form";
import { CompaniesBulkList } from "./companies-bulk-list";
import { createCompany } from "@/lib/actions/companies";
import { formatNumber } from "@/lib/format";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; senf?: string }>;
}) {
  const { q, senf } = await searchParams;
  const user = await requireUser();
  // Delete + bulk-select UI is for ADMIN/OWNER (members can't delete anything).
  const owner = canManageUsers(user.role);
  const and: Prisma.CompanyWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
        { senf: { contains: q, mode: "insensitive" } },
        { domain: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (senf) and.push({ senf });
  const where: Prisma.CompanyWhereInput = and.length ? { AND: and } : {};

  const [companies, senfRows] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { contacts: true, deals: true } },
      },
    }),
    prisma.company.findMany({
      where: { senf: { not: null } },
      select: { senf: true },
      distinct: ["senf"],
      orderBy: { senf: "asc" },
    }),
  ]);
  const senfOptions = senfRows
    .map((r) => r.senf)
    .filter((s): s is string => !!s)
    .map((s) => ({ value: s, label: s }));

  return (
    <div>
      <PageHeader
        title="شرکت‌ها"
        subtitle={`${formatNumber(companies.length)} شرکت`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="جستجوی شرکت‌ها…" />
            <SelectFilter param="senf" allLabel="همهٔ اصناف" options={senfOptions} />
            <CompanyForm mode="create" action={createCompany} />
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        <CompaniesBulkList
          isOwner={owner}
          companies={companies.map((c) => ({
            id: c.id,
            name: c.name,
            industry: c.industry,
            senf: c.senf,
            domain: c.domain,
            website: c.website,
            phone: c.phone,
            address: c.address,
            notes: c.notes,
            contactCount: c._count.contacts,
            dealCount: c._count.deals,
          }))}
        />
      </div>
    </div>
  );
}
