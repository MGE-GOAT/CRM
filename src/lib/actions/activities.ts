"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { ActivityType } from "@prisma/client";

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING"]),
  content: z.string().min(1, "Content is required").max(10000),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export async function logActivity(formData: FormData) {
  const user = await requireUser();
  const d = schema.parse({
    type: formData.get("type") || "NOTE",
    content: formData.get("content"),
    contactId: formData.get("contactId") || undefined,
    companyId: formData.get("companyId") || undefined,
    dealId: formData.get("dealId") || undefined,
  });
  await prisma.activity.create({
    data: {
      type: d.type as ActivityType,
      content: d.content,
      userId: user.id,
      contactId: d.contactId || null,
      companyId: d.companyId || null,
      dealId: d.dealId || null,
    },
  });
  if (d.contactId) revalidatePath(`/contacts/${d.contactId}`);
  if (d.companyId) revalidatePath(`/companies/${d.companyId}`);
  if (d.dealId) revalidatePath(`/deals/${d.dealId}`);
}
