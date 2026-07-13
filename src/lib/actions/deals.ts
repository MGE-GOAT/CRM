"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, systemOwnerId } from "@/lib/rbac";
import { parseAmount, toEn } from "@/lib/format";
import { DealStage, DealStatus } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است").max(300),
  // Cap aligns with the DB column Decimal(14,2) (max 999,999,999,999.99) so a
  // schema-valid value can't crash on insert with a generic DB error.
  value: z.coerce.number().min(0).max(999_999_999_999).default(0),
  stage: z.enum(STAGES),
  probability: z.coerce.number().min(0).max(100).default(10),
  companyId: z.string().optional(),
  contactId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  notes: z.string().max(10000).optional(),
  source: z.string().max(100).optional(),
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
      source: formData.get("source") || undefined,
    });
    const status = statusForStage(d.stage);
    // Normalize probability to the stage — WON is certain, LOST is dead — to
    // match updateDeal / moveDealStage (which both enforce this).
    const probability = d.stage === "WON" ? 100 : d.stage === "LOST" ? 0 : d.probability;
    await prisma.deal.create({
      data: {
        title: d.title,
        value: d.value,
        stage: d.stage as DealStage,
        status,
        probability,
        companyId: d.companyId || null,
        contactId: d.contactId || null,
        expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
        closedAt: status === "OPEN" ? null : new Date(),
        notes: d.notes || null,
        source: d.source || null,
        // Everything belongs to the OWNER — members/admins own nothing.
        ownerId: await systemOwnerId(user.id),
      },
    });
    revalidatePath("/deals");
  } catch (e) {
    return formError(e);
  }
}

export async function updateDeal(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const prev = await prisma.deal.findUniqueOrThrow({
      where: { id },
      select: { status: true, closedAt: true },
    });
    const d = schema.parse({
      title: formData.get("title"),
      value: parseAmount(String(formData.get("value") ?? "0")),
      stage: formData.get("stage") || "LEAD",
      probability: toEn(String(formData.get("probability") ?? "10")),
      companyId: formData.get("companyId") || undefined,
      contactId: formData.get("contactId") || undefined,
      expectedCloseDate: formData.get("expectedCloseDate") || undefined,
      notes: formData.get("notes") || undefined,
      source: formData.get("source") || undefined,
    });
    const status = statusForStage(d.stage);
    // Preserve the original close date when a deal was already closed (don't reset on edits).
    const closedAt =
      status === "OPEN" ? null : prev.status === "OPEN" ? new Date() : prev.closedAt ?? new Date();
    // Keep probability consistent with the stage (WON = 100%, LOST = 0%).
    const probability = status === "WON" ? 100 : status === "LOST" ? 0 : d.probability;
    await prisma.deal.update({
      where: { id },
      data: {
        title: d.title,
        value: d.value,
        stage: d.stage as DealStage,
        status,
        probability,
        companyId: d.companyId || null,
        contactId: d.contactId || null,
        expectedCloseDate: d.expectedCloseDate ? new Date(d.expectedCloseDate) : null,
        closedAt,
        notes: d.notes || null,
        source: d.source || null,
      },
    });
    revalidatePath("/deals");
  } catch (e) {
    return formError(e);
  }
}

/** Used by the Kanban board drag-to-stage. Returns { error } so the client can
 *  roll back the optimistic move when the server rejects it. */
export async function moveDealStage(id: string, stage: string): Promise<{ error?: string } | void> {
  const user = await requireUser();
  if (!STAGES.includes(stage as (typeof STAGES)[number])) return { error: "مرحلهٔ نامعتبر." };
  try {
    const prev = await prisma.deal.findUnique({
      where: { id },
      select: { status: true, closedAt: true },
    });
    if (!prev) return { error: "معامله یافت نشد." };
    const status = statusForStage(stage);
    const closedAt =
      status === "OPEN" ? null : prev.status === "OPEN" ? new Date() : prev.closedAt ?? new Date();
    const deal = await prisma.deal.update({
      where: { id },
      data: {
        stage: stage as DealStage,
        status,
        closedAt,
        // Keep probability consistent with the stage: WON=100, LOST=0, and when a
        // CLOSED deal is dragged back OPEN reset to the default (10) instead of
        // leaving it stuck at 100/0. An open→open move keeps the current value.
        ...(status === "WON"
          ? { probability: 100 }
          : status === "LOST"
            ? { probability: 0 }
            : prev.status !== "OPEN"
              ? { probability: 10 }
              : {}),
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
  } catch (e) {
    return formError(e);
  }
}

export async function deleteDeal(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    await prisma.deal.delete({ where: { id } });
    revalidatePath("/deals");
  } catch (e) {
    return formError(e);
  }
}
