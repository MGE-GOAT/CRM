"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";

export async function sendMessage(channelId: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const body = z
      .string()
      .min(1, "متن پیام خالی است")
      .max(4000, "پیام بیش از حد طولانی است")
      .parse(formData.get("body"));
    const replyToRaw = String(formData.get("replyToId") ?? "");
    const replyToId = replyToRaw || null;

    // ensure the user is a member of the channel
    const member = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: user.id } },
    });
    if (!member) throw new Error("شما عضو این کانال نیستید.");

    // validate the reply target belongs to the same channel
    let validReplyId: string | null = null;
    if (replyToId) {
      const target = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { channelId: true },
      });
      if (target && target.channelId === channelId) validReplyId = replyToId;
    }

    await prisma.message.create({
      data: { channelId, senderId: user.id, body, replyToId: validReplyId },
    });
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });
    revalidatePath(`/chat/${channelId}`);
  } catch (e) {
    return formError(e);
  }
}

export async function createChannel(
  formData: FormData
): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  try {
    const name = z
      .string()
      .min(1, "نام کانال الزامی است")
      .max(40, "نام کانال بیش از حد طولانی است")
      .parse(String(formData.get("name") ?? "").replace(/^#/, "").trim());
    const description =
      z.string().max(500).optional().parse(formData.get("description") || undefined) ?? null;

    // add all active users to a public channel
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        createdById: user.id,
        members: { create: users.map((u) => ({ userId: u.id })) },
      },
    });
    revalidatePath("/chat");
    return { id: channel.id };
  } catch (e) {
    return formError(e);
  }
}

/** Start (or reuse) a 1:1 direct-message channel with another user. */
export async function startDirectMessage(
  otherUserId: string
): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  try {
    if (otherUserId === user.id) throw new Error("نمی‌توانید به خودتان پیام دهید.");

    // find an existing direct channel containing exactly these two members
    const candidates = await prisma.channel.findMany({
      where: {
        isDirect: true,
        AND: [
          { members: { some: { userId: user.id } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: { _count: { select: { members: true } } },
    });
    const existing = candidates.find((c) => c._count.members === 2);
    if (existing) return { id: existing.id };

    const other = await prisma.user.findFirst({
      where: { id: otherUserId, isActive: true },
      select: { name: true },
    });
    if (!other) throw new Error("کاربر موردنظر یافت نشد.");

    const channel = await prisma.channel.create({
      data: {
        name: other.name,
        isDirect: true,
        createdById: user.id,
        members: { create: [{ userId: user.id }, { userId: otherUserId }] },
      },
    });
    revalidatePath("/chat");
    return { id: channel.id };
  } catch (e) {
    return formError(e);
  }
}

export async function markChannelRead(channelId: string) {
  const user = await requireUser();
  await prisma.channelMember.updateMany({
    where: { channelId, userId: user.id },
    data: { lastReadAt: new Date() },
  });
}
