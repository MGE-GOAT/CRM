"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { ActivityType } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  type: z.enum(["NOTE", "CALL", "EMAIL", "MEETING"]),
  content: z.string().min(1, "متن فعالیت الزامی است").max(10000),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
});

export async function logActivity(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Anti-spam: cap activity entries per user per minute.
    enforceRateLimit(`activity:log:${user.id}`, 60, 60 * 1000);

    const d = schema.parse({
      type: formData.get("type") || "NOTE",
      content: formData.get("content"),
      contactId: formData.get("contactId") || undefined,
      companyId: formData.get("companyId") || undefined,
      dealId: formData.get("dealId") || undefined,
    });

    // Must reference exactly one real entity. Verifying existence blocks
    // writing dangling activities or probing for valid IDs.
    if (!d.contactId && !d.companyId && !d.dealId) {
      throw new Error("فعالیت باید به یک مخاطب، شرکت یا معامله متصل باشد.");
    }
    if (d.contactId) {
      const found = await prisma.contact.findUnique({ where: { id: d.contactId }, select: { id: true } });
      if (!found) throw new Error("مخاطب موردنظر یافت نشد.");
    }
    if (d.companyId) {
      const found = await prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
      if (!found) throw new Error("شرکت موردنظر یافت نشد.");
    }
    if (d.dealId) {
      const found = await prisma.deal.findUnique({ where: { id: d.dealId }, select: { id: true } });
      if (!found) throw new Error("معامله موردنظر یافت نشد.");
    }

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
  } catch (e) {
    return formError(e);
  }
}
