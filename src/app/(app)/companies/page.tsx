import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { ConfirmDelete } from "@/components/confirm-delete";
import { SenfPill } from "@/components/ui/badge";
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

      <div className="p-4 sm:p-6">
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-[color:var(--rule)] bg-surface-2 text-right text-xs tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">صنف</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">دامنه</th>
                <th className="hidden px-4 py-3 text-center font-medium sm:table-cell">مخاطبین</th>
                <th className="hidden px-4 py-3 text-center font-medium sm:table-cell">معاملات</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    شرکتی یافت نشد.
                  </td>
                </tr>
              )}
              {companies.map((c) => (
                <tr key={c.id} className="hover:bg-[var(--gold-tint)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/companies/${c.id}`}
                      className="flex min-w-0 items-center gap-3 font-medium hover:text-[var(--brand)]"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-[var(--brand)]">
                        <Building2 size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0" title={c.name}>
                        <span className="block max-w-[12rem] truncate sm:max-w-[20rem]">
                          {c.name}
                        </span>
                        {c.industry && (
                          <span className="block max-w-[12rem] truncate text-xs font-normal text-muted sm:max-w-[20rem]">
                            {c.industry}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td
                    className="hidden max-w-[13rem] px-4 py-3 lg:table-cell"
                    title={c.senf ?? undefined}
                  >
                    {c.senf ? <SenfPill senf={c.senf} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell" dir="ltr">
                    {c.domain ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-center text-muted sm:table-cell">
                    {formatNumber(c._count.contacts)}
                  </td>
                  <td className="hidden px-4 py-3 text-center text-muted sm:table-cell">
                    {formatNumber(c._count.deals)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
