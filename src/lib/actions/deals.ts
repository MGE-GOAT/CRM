"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { parseAmount, toEn } from "@/lib/format";
import { DealStage, DealStatus } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است").max(300),
  value: z.coerce.number().min(0).max(1e15).default(0),
  stage: z.enum(STAGES),
  probability: z.coerce.number().min(0).max(100).default(10),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  notes: z.string().max(10000).optional(),
});

function statusForStage(stage: string): DealStatus {
  if (stage === "WON") return "WON";
  if (stage === "LOST") return "LOST";
  return "OPEN";
}

export async function createDeal(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const d = schema.parse({
      title: formData.get("title"),
      value: parseAmount(String(formData.get("value") ?? "0")),
      stage: formData.get("stage") || "LEAD",
      probability: toEn(String(formData.get("probability") ?? "10")),
      companyId: formData.get("companyId") || undefined,
      contactId: formData.get("contactId") || undefined,
      expectedCloseDate: formData.get("expectedCloseDate") || undefined,
      notes: formData.get("notes") || undefined,
    });
    const status = statusForStage(d.stage);
    await prisma.deal.create({
      data: {
        title: d.title,
        value: d.value,
        stage: d.stage as DealStage,
        status,
        probability: d.probability,
        companyId: d.companyId || null,
        contactId: d.contactId || null,
        expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
        closedAt: status === "OPEN" ? null : new Date(),
        notes: d.notes || null,
        ownerId: user.id,
      },
    });
    revalidatePath("/deals");
  } catch (e) {
    return formError(e);
  }
}

export async function updateDeal(id: string, formData: FormData): Promise<FormResult> {
  await requireUser();
  try {
    const d = schema.parse({
      title: formData.get("title"),
      value: parseAmount(String(formData.get("value") ?? "0")),
      stage: formData.get("stage") || "LEAD",
      probability: toEn(String(formData.get("probability") ?? "10")),
      companyId: formData.get("companyId") || undefined,
      contactId: formData.get("contactId") || undefined,
      expectedCloseDate: formData.get("expectedCloseDate") || undefined,
      notes: formData.get("notes") || undefined,
    });
    const status = statusForStage(d.stage);
    await prisma.deal.update({
      where: { id },
      data: {
        title: d.title,
        value: d.value,
        stage: d.stage as DealStage,
        status,
        probability: d.probability,
        companyId: d.companyId || null,
        contactId: d.contactId || null,
        expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
        closedAt: status === "OPEN" ? null : new Date(),
        notes: d.notes || null,
      },
    });
    revalidatePath("/deals");
  } catch (e) {
    return formError(e);
  }
}

/** Used by the Kanban board drag-to-stage. */
export async function moveDealStage(id: string, stage: string) {
  const user = await requireUser();
  if (!STAGES.includes(stage as (typeof STAGES)[number])) return;
  const status = statusForStage(stage);
  const deal = await prisma.deal.update({
    where: { id },
    data: {
      stage: stage as DealStage,
      status,
      closedAt: status === "OPEN" ? null : new Date(),
    },
  });
  await prisma.activity.create({
    data: {
      type: "STAGE_CHANGE",
      content: `moved this deal to ${stage.charAt(0) + stage.slice(1).toLowerCase()}`,
      userId: user.id,
      dealId: deal.id,
    },
  });
  revalidatePath("/deals");
}

export async function deleteDeal(id: string) {
  const user = await requireUser();
  const rec = await prisma.deal.findUniqueOrThrow({
    where: { id },
    select: { ownerId: true },
  });
  if (rec.ownerId !== user.id && !canManageUsers(user.role)) {
    throw new Error("اجازهٔ حذف این معامله را ندارید.");
  }
  await prisma.deal.delete({ where: { id } });
  revalidatePath("/deals");
}
