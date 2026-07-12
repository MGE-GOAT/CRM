import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { SelectFilter } from "@/components/select-filter";
import { ContactForm } from "./contact-form";
import { ImportContacts } from "./import-contacts";
import { ContactsBulkList } from "./contacts-bulk-list";
import { createContact } from "@/lib/actions/contacts";
import { formatNumber, toFa } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; company?: string; senf?: string; page?: string }>;
}) {
  const { q, company, senf, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const user = await requireUser();
  // Delete + bulk-select UI is for ADMIN/OWNER (members can't delete anything).
  const owner = canManageUsers(user.role);

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
        <ContactsBulkList
          isOwner={owner}
          companies={companies}
          contacts={contacts.map((c) => ({
            id: c.id,
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
            notes: c.notes,
            companyId: c.companyId,
            companyName: c.company?.name ?? null,
            ownerName: c.owner.name,
            ownerAvatarColor: c.owner.avatarColor,
          }))}
        />

        {totalPages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm" aria-label="صفحه‌بندی">
            <span className="text-muted">
              صفحه {toFa(page)} از {toFa(totalPages)}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-lg border border-border px-3 py-1.5 hover:bg-[var(--gold-tint)]"
                >
                  قبلی
                </Link>
              ) : (
                <span className="rounded-lg border border-border px-3 py-1.5 text-muted opacity-40">قبلی</span>
              )}
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-lg border border-border px-3 py-1.5 hover:bg-[var(--gold-tint)]"
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
