"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { SenfPill } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DuplicateButton } from "@/components/duplicate-button";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { ContactForm, type CompanyOption } from "./contact-form";
import {
  updateContact,
  deleteContact,
  duplicateContact,
  deleteContacts,
} from "@/lib/actions/contacts";
import { toFa } from "@/lib/format";

export type ContactRow = {
  id: string;
  firstName: string;
  lastName: string;
  factorName: string | null;
  economicCode: string | null;
  nationalId: string | null;
  registrationNumber: string | null;
  postalCode: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  senf: string | null;
  notes: string | null;
  companyId: string | null;
  companyName: string | null;
  ownerName: string;
  ownerAvatarColor: string;
};

export function ContactsBulkList({
  contacts,
  companies,
  isOwner,
}: {
  contacts: ContactRow[];
  companies: CompanyOption[];
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

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(contacts.map((c) => c.id)));
  const clear = () => setSelected(new Set());

  // colSpan for the empty-state row: base 7 columns + the checkbox column.
  const colSpan = isOwner ? 8 : 7;

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
              <th className="hidden px-4 py-3 font-medium md:table-cell">شرکت</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">صنف</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">تلفن</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">ایمیل</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">مسئول</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {contacts.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-muted">
                  مخاطبی یافت نشد.
                </td>
              </tr>
            )}
            {contacts.map((c) => {
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
                        aria-label={`انتخاب ${c.firstName} ${c.lastName}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="flex min-w-0 items-center gap-3 font-medium hover:text-[var(--brand)]"
                    >
                      <Avatar
                        name={`${c.firstName} ${c.lastName}`}
                        color={c.ownerAvatarColor}
                        size={32}
                      />
                      <span className="min-w-0" title={`${c.firstName} ${c.lastName}`}>
                        <span className="block max-w-[14rem] truncate sm:max-w-[24rem]">
                          {c.firstName} {c.lastName}
                        </span>
                        {c.title && (
                          <span className="block max-w-[14rem] truncate text-xs font-normal text-muted sm:max-w-[24rem]">
                            {c.title}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted md:table-cell">
                    {c.companyName ?? "—"}
                  </td>
                  <td
                    className="hidden max-w-[13rem] px-4 py-3 lg:table-cell"
                    title={c.senf ?? undefined}
                  >
                    {c.senf ? <SenfPill senf={c.senf} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell" dir="ltr">
                    {c.phone ? toFa(c.phone) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell" dir="ltr">
                    {c.email ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <Avatar name={c.ownerName} color={c.ownerAvatarColor} size={22} />
                      {c.ownerName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <ContactForm
                        mode="edit"
                        action={updateContact.bind(null, c.id)}
                        companies={companies}
                        values={{
                          firstName: c.firstName,
                          lastName: c.lastName,
                          factorName: c.factorName,
                          economicCode: c.economicCode,
                          nationalId: c.nationalId,
                          registrationNumber: c.registrationNumber,
                          postalCode: c.postalCode,
                          email: c.email,
                          phone: c.phone,
                          title: c.title,
                          senf: c.senf,
                          companyId: c.companyId,
                          notes: c.notes,
                        }}
                      />
                      <DuplicateButton onDuplicate={duplicateContact.bind(null, c.id)} />
                      {isOwner && (
                        <ConfirmDelete onDelete={deleteContact.bind(null, c.id)} iconOnly />
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
            const res = await deleteContacts([...selected]);
            if (!res?.error) clear();
            return res;
          }}
          noun="مخاطب"
        />
      )}
    </>
  );
}
