"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, systemOwnerId } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseContacts } from "@/lib/vcard";

const schema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
  factorName: z.string().max(300).optional(),
  economicCode: z.string().max(50).optional(),
  nationalId: z.string().max(50).optional(),
  registrationNumber: z.string().max(50).optional(),
  postalCode: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().max(300).optional(),
  senf: z.string().max(120).optional(),
  companyId: z.string().optional(),
  notes: z.string().max(10000).optional(),
});

function parse(formData: FormData) {
  return schema.parse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    factorName: formData.get("factorName") || undefined,
    economicCode: formData.get("economicCode") || undefined,
    nationalId: formData.get("nationalId") || undefined,
    registrationNumber: formData.get("registrationNumber") || undefined,
    postalCode: formData.get("postalCode") || undefined,
    email: formData.get("email") || "",
    phone: formData.get("phone") || undefined,
    title: formData.get("title") || undefined,
    senf: formData.get("senf") || undefined,
    companyId: formData.get("companyId") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createContact(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const data = parse(formData);
    await prisma.contact.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        factorName: data.factorName || null,
        economicCode: data.economicCode || null,
        nationalId: data.nationalId || null,
        registrationNumber: data.registrationNumber || null,
        postalCode: data.postalCode || null,
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
        senf: data.senf || null,
        companyId: data.companyId || null,
        notes: data.notes || null,
        // Everything belongs to the OWNER — members/admins own nothing.
        ownerId: await systemOwnerId(user.id),
      },
    });
    revalidatePath("/contacts");
  } catch (e) {
    return formError(e);
  }
}

export async function updateContact(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Shared pool under the owner — any team member may edit; only ADMIN/OWNER
    // may delete. (Ownership no longer gates edits since the owner owns all.)
    const data = parse(formData);
    await prisma.contact.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        factorName: data.factorName || null,
        economicCode: data.economicCode || null,
        nationalId: data.nationalId || null,
        registrationNumber: data.registrationNumber || null,
        postalCode: data.postalCode || null,
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
        senf: data.senf || null,
        companyId: data.companyId || null,
        notes: data.notes || null,
      },
    });
    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
  } catch (e) {
    return formError(e);
  }
}

export async function deleteContact(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    await prisma.contact.delete({ where: { id } });
    revalidatePath("/contacts");
  } catch (e) {
    return formError(e);
  }
}

const MAX_BULK = 500;

export async function deleteContacts(ids: string[]): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Delete is ADMIN/OWNER-only — enforced here at the server boundary, not
    // just hidden in the UI (a client could call this action directly).
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("موردی برای حذف انتخاب نشده است.");
    }
    if (ids.length > MAX_BULK || !ids.every((id) => typeof id === "string" && id)) {
      throw new Error("درخواست حذف نامعتبر است.");
    }
    await prisma.contact.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/contacts");
  } catch (e) {
    return formError(e);
  }
}

export async function duplicateContact(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const src = await prisma.contact.findUniqueOrThrow({ where: { id } });
    await prisma.contact.create({
      data: {
        firstName: src.firstName,
        lastName: `${src.lastName} (کپی)`,
        email: src.email,
        phone: src.phone,
        title: src.title,
        senf: src.senf,
        notes: src.notes,
        companyId: src.companyId,
        ownerId: await systemOwnerId(user.id),
      },
    });
    revalidatePath("/contacts");
  } catch (e) {
    return formError(e);
  }
}

export type ImportResult = { imported?: number; duplicates?: number; error?: string };

/** Bulk-import contacts from an uploaded vCard (.vcf) or CSV file. */
export async function importContacts(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  try {
    enforceRateLimit(`contacts:import:${user.id}`, 5, 60 * 1000);

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "فایلی انتخاب نشده است." };
    }
    if (file.size > 20 * 1024 * 1024) {
      return { error: "حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)." };
    }

    // parseContacts is bounded internally (MAX_CONTACTS) so a huge/crafted file
    // can't materialise an oversized array before we cap it.
    const rows = parseContacts(await file.text());
    if (rows.length === 0) {
      return { error: "مخاطبی در فایل پیدا نشد. یک فایل vCard (.vcf) یا CSV معتبر انتخاب کنید." };
    }
    const total = rows.length;

    const digits = (s: string) => s.replace(/\D/g, "");

    // De-duplicate within the file by phone, else email. Name-only rows (no
    // phone/email) get a per-row key so two DIFFERENT people who happen to share
    // a name aren't collapsed into one.
    const seen = new Set<string>();
    const unique = rows.filter((c, idx) => {
      const key =
        digits(c.phone) ||
        c.email.toLowerCase() ||
        `n:${idx}:${c.firstName}|${c.lastName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // De-duplicate against contacts already in the CRM (no DB unique constraint).
    // Bounded take so this can't load an unbounded table into memory.
    const existing = await prisma.contact.findMany({
      select: { phone: true, email: true },
      take: 100000,
    });
    const existingPhones = new Set(existing.map((e) => digits(e.phone ?? "")).filter(Boolean));
    const existingEmails = new Set(existing.map((e) => (e.email ?? "").toLowerCase()).filter(Boolean));
    const toInsert = unique.filter((c) => {
      const p = digits(c.phone);
      if (p && existingPhones.has(p)) return false;
      if (c.email && existingEmails.has(c.email.toLowerCase())) return false;
      return true;
    });

    // Everything imported belongs to the OWNER (members/admins own nothing).
    const ownerId = await systemOwnerId(user.id);

    // Create/link companies named in the file (e.g. business names the file
    // carries in an Organization/Company column). Reuse an existing company of
    // the same name; otherwise create it once. Bounded and deduped.
    const companyId = new Map<string, string>();
    const wanted = [
      ...new Set(toInsert.map((c) => c.company?.trim()).filter((n): n is string => !!n)),
    ].map((n) => n.slice(0, 200));
    if (wanted.length) {
      const found = await prisma.company.findMany({
        where: { name: { in: wanted } },
        select: { id: true, name: true },
      });
      for (const co of found) if (!companyId.has(co.name)) companyId.set(co.name, co.id);
      const missing = wanted.filter((n) => !companyId.has(n));
      for (let i = 0; i < missing.length; i += 200) {
        await prisma.company.createMany({
          data: missing.slice(i, i + 200).map((name) => ({ name, ownerId })),
        });
      }
      if (missing.length) {
        const created = await prisma.company.findMany({
          where: { name: { in: missing } },
          select: { id: true, name: true },
        });
        for (const co of created) if (!companyId.has(co.name)) companyId.set(co.name, co.id);
      }
    }

    let imported = 0;
    const CHUNK = 500;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const data = toInsert.slice(i, i + CHUNK).map((c) => ({
        firstName: (c.firstName || "بدون‌نام").slice(0, 100),
        lastName: c.lastName.slice(0, 100),
        // Primary number in phone; every extra number is preserved in notes.
        phone: c.phone ? c.phone.slice(0, 40) : null,
        email: c.email ? c.email.slice(0, 200) : null,
        title: c.title ? c.title.slice(0, 200) : null,
        senf: c.senf ? c.senf.slice(0, 120) : null,
        notes: c.notes ? c.notes.slice(0, 10000) : null,
        companyId: (c.company && companyId.get(c.company.trim())) || null,
        ownerId,
      }));
      const res = await prisma.contact.createMany({ data });
      imported += res.count;
    }

    revalidatePath("/contacts");
    return { imported, duplicates: total - imported };
  } catch (e) {
    return { error: formError(e).error };
  }
}
