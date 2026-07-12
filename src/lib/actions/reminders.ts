"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { ReminderAction } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";

const schema = z.object({
  title: z.string().max(300).optional(),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ معتبر وارد کنید"),
  time: z.string().optional(),
  isPublic: z.boolean(),
  color: z.string().max(20).optional(),
  action: z.enum(["GENERAL", "CALL", "WHATSAPP", "SMS"]),
  contactId: z.string().optional(),
  messageBody: z.string().max(2000).optional(),
});

const actionLabel: Record<string, string> = {
  GENERAL: "یادآوری",
  CALL: "تماس با",
  WHATSAPP: "پیام واتساپ به",
  SMS: "پیامک به",
};

function parse(formData: FormData) {
  return schema.parse({
    title: formData.get("title") || undefined,
    description: formData.get("description") || undefined,
    date: formData.get("date"),
    time: formData.get("time") || undefined,
    isPublic: formData.get("isPublic") === "on" || formData.get("isPublic") === "true",
    color: formData.get("color") || undefined,
    action: formData.get("action") || "GENERAL",
    contactId: formData.get("contactId") || undefined,
    messageBody: formData.get("messageBody") || undefined,
  });
}

async function buildData(d: ReturnType<typeof parse>) {
  const time = d.time && /^\d{1,2}:\d{2}$/.test(d.time) ? d.time : "09:00";
  const date = new Date(`${d.date}T${time}:00`);

  let title = d.title?.trim() || "";
  if (!title) {
    if (d.action !== "GENERAL" && d.contactId) {
      const c = await prisma.contact.findUnique({
        where: { id: d.contactId },
        select: { firstName: true, lastName: true },
      });
      title = `${actionLabel[d.action]} ${c ? `${c.firstName} ${c.lastName}` : ""}`.trim();
    } else {
      title = "یادآوری";
    }
  }

  return {
    title,
    description: d.description || null,
    date,
    isPublic: d.isPublic,
    color: d.color || "#d4af37",
    action: d.action as ReminderAction,
    contactId: d.action === "GENERAL" ? null : d.contactId || null,
    messageBody:
      d.action === "WHATSAPP" || d.action === "SMS" ? d.messageBody || null : null,
  };
}

export async function createReminder(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const data = await buildData(parse(formData));
    await prisma.reminder.create({ data: { ...data, createdById: user.id } });
    revalidatePath("/calendar");
  } catch (e) {
    return formError(e);
  }
}

async function assertCanEdit(id: string, userId: string, role: Parameters<typeof canManageUsers>[0]) {
  const r = await prisma.reminder.findUniqueOrThrow({
    where: { id },
    select: { createdById: true },
  });
  if (r.createdById !== userId && !canManageUsers(role)) {
    throw new Error("اجازهٔ تغییر این یادآوری را ندارید.");
  }
}

export async function updateReminder(id: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    await assertCanEdit(id, user.id, user.role);
    const data = await buildData(parse(formData));
    await prisma.reminder.update({ where: { id }, data });
    revalidatePath("/calendar");
  } catch (e) {
    return formError(e);
  }
}

export async function toggleReminderDone(id: string, done: boolean): Promise<FormResult> {
  const user = await requireUser();
  try {
    await assertCanEdit(id, user.id, user.role);
    await prisma.reminder.update({ where: { id }, data: { done } });
    revalidatePath("/calendar");
  } catch (e) {
    return formError(e);
  }
}

export async function deleteReminder(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    await prisma.reminder.delete({ where: { id } });
    revalidatePath("/calendar");
  } catch (e) {
    return formError(e);
  }
}
