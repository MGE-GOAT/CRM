"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";

const schema = z.object({
  name: z.string().min(1, "نام شرکت الزامی است"),
  industry: z.string().optional(),
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
        domain: d.domain || null,
        website: d.website || null,
        phone: d.phone || null,
        address: d.address || null,
        notes: d.notes || null,
        ownerId: user.id,
      },
    });
    revalidatePath("/companies");
  } catch (e) {
    return formError(e);
  }
}

export async function updateCompany(id: string, formData: FormData): Promise<FormResult> {
  await requireUser();
  try {
    const d = parse(formData);
    await prisma.company.update({
      where: { id },
      data: {
        name: d.name,
        industry: d.industry || null,
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

export async function deleteCompany(id: string) {
  const user = await requireUser();
  const rec = await prisma.company.findUniqueOrThrow({
    where: { id },
    select: { ownerId: true },
  });
  if (rec.ownerId !== user.id && !canManageUsers(user.role)) {
    throw new Error("اجازهٔ حذف این شرکت را ندارید.");
  }
  await prisma.company.delete({ where: { id } });
  revalidatePath("/companies");
}
