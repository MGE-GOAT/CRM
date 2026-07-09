import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDelete } from "@/components/confirm-delete";
import { DuplicateButton } from "@/components/duplicate-button";
import { ContactForm } from "./contact-form";
import { ImportContacts } from "./import-contacts";
import {
  createContact,
  updateContact,
  deleteContact,
  duplicateContact,
} from "@/lib/actions/contacts";
import { formatNumber, toFa } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; senf?: string; page?: string }>;
}) {
  const { q, company, senf, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const and: Prisma.ContactWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }
  if (company) and.push({ companyId: company });
  if (senf) and.push({ senf });
  const where: Prisma.ContactWhereInput = and.length ? { AND: and } : {};

  const [contacts, total, companies, senfRows] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { name: true } },
        owner: { select: { name: true, avatarColor: true } },
      },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.contact.count({ where }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      where: { senf: { not: null } },
      select: { senf: true },
      distinct: ["senf"],
      orderBy: { senf: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (company) sp.set("company", company);
    if (senf) sp.set("senf", senf);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/contacts?${qs}` : "/contacts";
  };
  const senfOptions = senfRows
    .map((r) => r.senf)
    .filter((s): s is string => !!s)
    .map((s) => ({ value: s, label: s }));

  return (
    <div>
      <PageHeader
        title="مخاطبین"
        subtitle={`${formatNumber(total)} مخاطب`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput placeholder="جستجوی نام، ایمیل یا تلفن…" />
            <SelectFilter
              param="company"
              allLabel="همهٔ شرکت‌ها"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectFilter param="senf" allLabel="همهٔ اصناف" options={senfOptions} />
            <ImportContacts />
            <ContactForm mode="create" action={createContact} companies={companies} />
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-gray-50 text-right text-xs tracking-wide text-muted">
              <tr>
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
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    مخاطبی یافت نشد.
                  </td>
                </tr>
              )}
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="flex min-w-0 items-center gap-3 font-medium hover:text-[var(--brand)]"
                    >
                      <Avatar
                        name={`${c.firstName} ${c.lastName}`}
                        color={c.owner.avatarColor}
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
                    {c.company?.name ?? "—"}
                  </td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3 text-muted lg:table-cell" title={c.senf ?? undefined}>
                    {c.senf ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell" dir="ltr">
                    {c.phone ? toFa(c.phone) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-muted lg:table-cell" dir="ltr">
                    {c.email ?? "—"}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className="inline-flex items-center gap-2 text-muted">
                      <Avatar name={c.owner.name} color={c.owner.avatarColor} size={22} />
                      {c.owner.name}
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
                          email: c.email,
                          phone: c.phone,
                          title: c.title,
                          senf: c.senf,
                          companyId: c.companyId,
                          notes: c.notes,
                        }}
                      />
                      <DuplicateButton onDuplicate={duplicateContact.bind(null, c.id)} />
                      <ConfirmDelete onDelete={deleteContact.bind(null, c.id)} iconOnly />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm" aria-label="صفحه‌بندی">
            <span className="text-muted">
              صفحه {toFa(page)} از {toFa(totalPages)}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-lg border border-border px-3 py-1.5 hover:bg-gray-50"
                >
                  قبلی
                </Link>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-muted opacity-40">قبلی</span>
              )}
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-lg border border-border px-3 py-1.5 hover:bg-gray-50"
                >
                  بعدی
                </Link>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-muted opacity-40">بعدی</span>
              )}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
