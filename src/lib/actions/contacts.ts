"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";

const schema = z.object({
  firstName: z.string().min(1, "نام الزامی است"),
  lastName: z.string().min(1, "نام خانوادگی الزامی است"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().max(300).optional(),
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
  await requireUser();
  try {
    const data = parse(formData);
    await prisma.contact.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
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

export async function deleteContact(id: string) {
  const user = await requireUser();
  const rec = await prisma.contact.findUniqueOrThrow({
    where: { id },
    select: { ownerId: true },
  });
  if (rec.ownerId !== user.id && !canManageUsers(user.role)) {
    throw new Error("اجازهٔ حذف این مخاطب را ندارید.");
  }
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contacts");
}

export async function duplicateContact(id: string) {
  const user = await requireUser();
  const src = await prisma.contact.findUniqueOrThrow({ where: { id } });
  await prisma.contact.create({
    data: {
      firstName: src.firstName,
      lastName: `${src.lastName} (کپی)`,
      email: src.email,
      phone: src.phone,
      title: src.title,
      notes: src.notes,
      companyId: src.companyId,
      ownerId: user.id,
    },
  });
  revalidatePath("/contacts");
}
