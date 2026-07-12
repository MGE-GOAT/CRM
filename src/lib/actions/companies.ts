"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, systemOwnerId } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";

const schema = z.object({
  name: z.string().min(1, "نام شرکت الزامی است"),
  industry: z.string().optional(),
  senf: z.string().max(120).optional(),
  domain: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(10000).optional(),
});

function parse(formData: FormData) {
  return schema.parse({
    name: formData.get("name"),
    industry: formData.get("industry") || undefined,
    senf: formData.get("senf") || undefined,
    domain: formData.get("domain") || undefined,
    website: formData.get("website") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createCompany(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const d = parse(formData);
    await prisma.company.create({
      data: {
        name: d.name,
        industry: d.industry || null,
        senf: d.senf || null,
        domain: d.domain || null,
        website: d.website || null,
        phone: d.phone || null,
        address: d.address || null,
        notes: d.notes || null,
        // Everything belongs to the OWNER — members/admins own nothing.
        ownerId: await systemOwnerId(user.id),
      },
    });
    revalidatePath("/companies");
  } catch (e) {
    return formError(e);
  }
}

export async function updateCompany(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Shared pool under the owner — any team member may edit; delete is
    // ADMIN/OWNER-only.
    const d = parse(formData);
    await prisma.company.update({
      where: { id },
      data: {
        name: d.name,
        industry: d.industry || null,
        senf: d.senf || null,
        domain: d.domain || null,
        website: d.website || null,
        phone: d.phone || null,
        address: d.address || null,
        notes: d.notes || null,
      },
    });
    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
  } catch (e) {
    return formError(e);
  }
}

export async function deleteCompany(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    await prisma.company.delete({ where: { id } });
    revalidatePath("/companies");
  } catch (e) {
    return formError(e);
  }
}

const MAX_BULK = 500;

export async function deleteCompanies(ids: string[]): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Bulk delete is OWNER-only — enforced here at the server boundary, not just
    // hidden in the UI (a client could call this action directly). Related
    // contacts/deals detach automatically (companyId is onDelete: SetNull).
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error("موردی برای حذف انتخاب نشده است.");
    }
    if (ids.length > MAX_BULK || !ids.every((id) => typeof id === "string" && id)) {
      throw new Error("درخواست حذف نامعتبر است.");
    }
    await prisma.company.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/companies");
  } catch (e) {
    return formError(e);
  }
}
