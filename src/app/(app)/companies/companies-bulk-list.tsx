"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { SenfPill } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { CompanyForm } from "./company-form";
import { updateCompany, deleteCompany, deleteCompanies } from "@/lib/actions/companies";
import { formatNumber } from "@/lib/format";

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  senf: string | null;
  domain: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  contactCount: number;
  dealCount: number;
};

export function CompaniesBulkList({
  companies,
  isOwner,
}: {
  companies: CompanyRow[];
  isOwner: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = companies.length > 0 && selected.size === companies.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(companies.map((c) => c.id)));
  const clear = () => setSelected(new Set());

  // colSpan for the empty-state row: base 6 columns + the checkbox column.
  const colSpan = isOwner ? 7 : 6;

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
        <table className="w-full text-sm">
          <thead className="border-b-2 border-[color:var(--rule)] bg-surface-2 text-right text-xs tracking-wide text-muted">
            <tr>
              {isOwner && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-[var(--gold)]"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="انتخاب همه"
                  />
                </th>
              )}
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
                <td colSpan={colSpan} className="px-4 py-10 text-center text-muted">
                  شرکتی یافت نشد.
                </td>
              </tr>
            )}
            {companies.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <tr
                  key={c.id}
                  className={isSelected ? "bg-[var(--gold-tint)]" : "hover:bg-[var(--gold-tint)]"}
                >
                  {isOwner && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-[var(--gold)]"
                        checked={isSelected}
                        onChange={() => toggle(c.id)}
                        aria-label={`انتخاب ${c.name}`}
                      />
                    </td>
                  )}
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
                    {formatNumber(c.contactCount)}
                  </td>
                  <td className="hidden px-4 py-3 text-center text-muted sm:table-cell">
                    {formatNumber(c.dealCount)}
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
                      {isOwner && (
                        <ConfirmDelete onDelete={deleteCompany.bind(null, c.id)} iconOnly />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isOwner && (
        <BulkActionBar
          count={selected.size}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onClear={clear}
          onDelete={async () => {
            const res = await deleteCompanies([...selected]);
            if (!res?.error) clear();
            return res;
          }}
          noun="شرکت"
        />
      )}
    </>
  );
}
