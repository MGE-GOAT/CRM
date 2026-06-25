"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { TaskPriority } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است").max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.string().optional(),
  assigneeId: z.string().min(1, "انتخاب مسئول الزامی است"),
  dealId: z.string().optional(),
  contactId: z.string().optional(),
});

export async function createTask(formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const d = schema.parse({
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      priority: formData.get("priority") || "MEDIUM",
      dueDate: formData.get("dueDate") || undefined,
      assigneeId: formData.get("assigneeId") || user.id,
      dealId: formData.get("dealId") || undefined,
      contactId: formData.get("contactId") || undefined,
    });
    // assignee must be a real, active user
    const assignee = await prisma.user.findFirst({
      where: { id: d.assigneeId, isActive: true },
      select: { id: true },
    });
    if (!assignee) throw new Error("مسئول انتخاب‌شده معتبر نیست.");
    await prisma.task.create({
      data: {
        title: d.title,
        description: d.description || null,
        priority: d.priority as TaskPriority,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        assigneeId: d.assigneeId,
        dealId: d.dealId || null,
        contactId: d.contactId || null,
      },
    });
    revalidatePath("/tasks");
  } catch (e) {
    return formError(e);
  }
}

export async function toggleTask(id: string, completed: boolean) {
  await requireUser();
  await prisma.task.update({ where: { id }, data: { completed } });
  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  const rec = await prisma.task.findUniqueOrThrow({
    where: { id },
    select: { assigneeId: true },
  });
  if (rec.assigneeId !== user.id && !canManageUsers(user.role)) {
    throw new Error("اجازهٔ حذف این وظیفه را ندارید.");
  }
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
}
