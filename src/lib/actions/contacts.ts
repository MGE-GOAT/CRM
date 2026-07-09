"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { parseContacts } from "@/lib/vcard";

const schema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
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
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
        senf: data.senf || null,
        companyId: data.companyId || null,
        notes: data.notes || null,
        ownerId: user.id,
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
    const rec = await prisma.contact.findUniqueOrThrow({ where: { id }, select: { ownerId: true } });
    if (rec.ownerId !== user.id && !canManageUsers(user.role)) {
      throw new Error("اجازهٔ ویرایش این مخاطب را ندارید.");
    }
    const data = parse(formData);
    await prisma.contact.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
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
    const rec = await prisma.contact.findUniqueOrThrow({
      where: { id },
      select: { ownerId: true },
    });
    if (rec.ownerId !== user.id && !canManageUsers(user.role)) {
      throw new Error("اجازهٔ حذف این مخاطب را ندارید.");
    }
    await prisma.contact.delete({ where: { id } });
    revalidatePath("/contacts");
  } catch (e) {
    return formError(e);
  }
}

export async function duplicateContact(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const src = await prisma.contact.findUniqueOrThrow({ where: { id } });
    // Same ownership gate as update/delete — a member can't clone a contact they
    // don't own into a record they'd fully control.
    if (src.ownerId !== user.id && !canManageUsers(user.role)) {
      return { error: "اجازهٔ کپی این مخاطب را ندارید." };
    }
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
        ownerId: user.id,
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
        ownerId: user.id,
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
