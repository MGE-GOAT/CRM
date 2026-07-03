import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CompanyForm } from "./company-form";
import { createCompany, updateCompany, deleteCompany } from "@/lib/actions/companies";
import { formatNumber } from "@/lib/format";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; senf?: string }>;
}) {
  const { q, senf } = await searchParams;
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

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {companies.length === 0 && (
          <p className="col-span-full py-10 text-center text-muted">
            شرکتی یافت نشد.
          </p>
        )}
        {companies.map((c) => (
          <div
            key={c.id}
            className="group rounded-xl border border-border bg-surface p-4 transition hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-[var(--brand)]">
                <Building2 size={18} />
              </div>
              <div className="flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <CompanyForm
                  mode="edit"
                  action={updateCompany.bind(null, c.id)}
                  values={{
                    name: c.name,
                    industry: c.industry,
                    senf: c.senf,
                    domain: c.domain,
                    website: c.website,
                    phone: c.phone,
                    address: c.address,
                    notes: c.notes,
                  }}
                />
                <ConfirmDelete onDelete={deleteCompany.bind(null, c.id)} iconOnly />
              </div>
            </div>
            <Link href={`/companies/${c.id}`} className="mt-3 block">
              <h3 className="font-semibold hover:text-[var(--brand)]">{c.name}</h3>
              <p className="text-sm text-muted">{c.industry ?? "—"}</p>
              {c.senf && <p className="text-xs text-muted">صنف: {c.senf}</p>}
            </Link>
            <div className="mt-3 flex gap-4 text-xs text-muted">
              <span>{formatNumber(c._count.contacts)} مخاطب</span>
              <span>{formatNumber(c._count.deals)} معامله</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
