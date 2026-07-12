"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { TaskPriority } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";
import { getOrCreateDirectChannel } from "@/lib/chat-dm";
import { formatDateTime } from "@/lib/format";

const PRIORITY_FA: Record<string, string> = { LOW: "کم", MEDIUM: "متوسط", HIGH: "زیاد" };

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است").max(300),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  dueDate: z.string().optional(),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, "ساعت نامعتبر است").optional(),
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
      dueTime: formData.get("dueTime") || undefined,
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
    // Explicit +03:30 so the instant is correct regardless of server timezone.
    const dueDate = d.dueDate
      ? new Date(`${d.dueDate}T${d.dueTime ?? "09:00"}:00+03:30`)
      : null;
    const task = await prisma.task.create({
      data: {
        title: d.title,
        description: d.description || null,
        priority: d.priority as TaskPriority,
        // Combine the Jalali-picked date with the time (local TZ = Asia/Tehran).
        dueDate,
        assigneeId: d.assigneeId,
        dealId: d.dealId || null,
        contactId: d.contactId || null,
      },
    });
    // When assigning to someone else: notify them AND drop a task-assignment
    // card into their private chat with the assigner (they acknowledge it).
    if (d.assigneeId !== user.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: d.assigneeId,
            type: "TASK",
            title: "وظیفهٔ جدید",
            body: d.title,
            href: "/tasks",
          },
        });
        const dmId = await getOrCreateDirectChannel(user.id, d.assigneeId);
        const lines = [
          `عنوان: ${d.title}`,
          `اولویت: ${PRIORITY_FA[d.priority] ?? d.priority}`,
          `مهلت: ${dueDate ? formatDateTime(dueDate) : "بدون مهلت"}`,
        ];
        if (d.description) lines.push(`توضیحات: ${d.description}`);
        await prisma.message.create({
          data: {
            channelId: dmId,
            senderId: user.id,
            kind: "TASK_ASSIGN",
            taskId: task.id,
            body: lines.join("\n"),
          },
        });
        revalidatePath(`/chat/${dmId}`);
        revalidatePath("/chat");
      } catch (err) {
        console.error("task assignment card failed", err);
      }
    }
    revalidatePath("/tasks");
  } catch (e) {
    return formError(e);
  }
}

export async function toggleTask(id: string, completed: boolean) {
  const user = await requireUser();
  const rec = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true } });
  if (!rec) return;
  if (rec.assigneeId !== user.id && !canManageUsers(user.role)) return; // not permitted
  await prisma.task.update({ where: { id }, data: { completed } });
  revalidatePath("/tasks");
}

export async function deleteTask(id: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const rec = await prisma.task.findUniqueOrThrow({
      where: { id },
      select: { assigneeId: true },
    });
    if (!canManageUsers(user.role)) {
      throw new Error("فقط مدیر یا مالک می‌تواند حذف کند.");
    }
    await prisma.task.delete({ where: { id } });
    revalidatePath("/tasks");
  } catch (e) {
    return formError(e);
  }
}
