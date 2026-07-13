"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, roleRank, systemOwnerId } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";
import { enforceRateLimit } from "@/lib/rate-limit";
import { saveUpload, deleteUpload } from "@/lib/storage";

const MAX_FILES_PER_MESSAGE = 6;

/** Membership guard — throws a Farsi error if the user isn't in the channel. */
async function assertMember(channelId: string, userId: string) {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  });
  if (!member) throw new Error("شما عضو این کانال نیستید.");
  return member;
}

/**
 * Any member of a (non-direct) group may manage it — create/rename/add. The
 * hierarchical checks (who you can kick / whether you can delete) live in the
 * individual actions and compare role ranks. Direct channels are never managed.
 */
async function assertGroupMember(channelId: string, userId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { createdById: true, isDirect: true },
  });
  if (!channel) throw new Error("کانال یافت نشد.");
  if (channel.isDirect) throw new Error("این عمل روی پیام مستقیم ممکن نیست.");
  await assertMember(channelId, userId);
  return channel;
}

/** Truncate a preview to a sane length for a notification body. */
function messagePreview(body: string | undefined, hasFiles: boolean): string {
  const text = body?.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  return hasFiles ? "فایل" : "";
}

/**
 * Emit a MESSAGE notification to every channel member except the sender.
 * Best-effort: a notification failure must never fail the message send.
 */
async function notifyChannelMembers(
  channelId: string,
  sender: { id: string; name: string },
  body: string | undefined,
  hasFiles: boolean,
) {
  try {
    const members = await prisma.channelMember.findMany({
      where: { channelId, userId: { not: sender.id } },
      select: { userId: true },
    });
    if (members.length === 0) return;
    await prisma.notification.createMany({
      data: members.map((m) => ({
        userId: m.userId,
        type: "MESSAGE" as const,
        title: sender.name,
        body: messagePreview(body, hasFiles) || null,
        href: `/chat/${channelId}`,
      })),
    });
  } catch (err) {
    console.error("notifyChannelMembers failed", err);
  }
}

export async function sendMessage(channelId: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    // Anti-spam: cap messages per user per minute.
    enforceRateLimit(`chat:send:${user.id}`, 30, 60 * 1000);
    const body = z
      .string()
      .max(4000, "پیام بیش از حد طولانی است")
      .optional()
      .parse(formData.get("body") ?? undefined)
      ?.trim();

    const files = formData
      .getAll("files")
      .filter((f): f is File => f instanceof File && f.size > 0)
      .slice(0, MAX_FILES_PER_MESSAGE);

    // A message must carry text or at least one file.
    if (!body && files.length === 0) throw new Error("متن پیام خالی است");

    const replyToRaw = String(formData.get("replyToId") ?? "");
    const replyToId = replyToRaw || null;

    await assertMember(channelId, user.id);

    // validate the reply target belongs to the same channel
    let validReplyId: string | null = null;
    if (replyToId) {
      const target = await prisma.message.findUnique({
        where: { id: replyToId },
        select: { channelId: true },
      });
      if (target && target.channelId === channelId) validReplyId = replyToId;
    }

    // Persist file bytes to disk before the DB row (fail early on bad files).
    const saved = await Promise.all(files.map((f) => saveUpload(f)));

    await prisma.message.create({
      data: {
        channelId,
        senderId: user.id,
        body: body || null,
        replyToId: validReplyId,
        attachments: saved.length
          ? {
              create: saved.map((s) => ({
                fileName: s.fileName,
                mimeType: s.mimeType,
                size: s.size,
                storageKey: s.storageKey,
              })),
            }
          : undefined,
      },
    });
    await prisma.channelMember.update({
      where: { channelId_userId: { channelId, userId: user.id } },
      data: { lastReadAt: new Date() },
    });
    // Notify every other channel member (one round-trip via createMany).
    await notifyChannelMembers(channelId, user, body, saved.length > 0);
    revalidatePath(`/chat/${channelId}`);
  } catch (e) {
    return formError(e);
  }
}

/** Edit one's own message (text only). Marks editedAt. */
export async function editMessage(messageId: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    const body = z
      .string()
      .min(1, "متن پیام خالی است")
      .max(4000, "پیام بیش از حد طولانی است")
      .parse(String(formData.get("body") ?? "").trim());

    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, channelId: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) throw new Error("پیام یافت نشد.");
    // Must still be a member of the channel (a removed user can't keep editing).
    await assertMember(msg.channelId, user.id);
    if (msg.senderId !== user.id) throw new Error("فقط فرستنده می‌تواند پیام را ویرایش کند.");

    await prisma.message.update({
      where: { id: messageId },
      data: { body, editedAt: new Date() },
    });
    revalidatePath(`/chat/${msg.channelId}`);
  } catch (e) {
    return formError(e);
  }
}

/** Soft-delete a message. Sender, or an OWNER/ADMIN, may delete. */
export async function deleteMessage(messageId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { senderId: true, channelId: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) throw new Error("پیام یافت نشد.");
    // Must be a member of the owning channel to delete anything in it.
    await assertMember(msg.channelId, user.id);
    if (msg.senderId !== user.id && !canManageUsers(user.role)) {
      throw new Error("اجازهٔ حذف این پیام را ندارید.");
    }
    await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), body: null, editedAt: null },
    });
    // Detach attachments so deleted messages carry nothing — and reclaim the
    // bytes from disk (deleting only the DB rows would orphan the files).
    const attachments = await prisma.attachment.findMany({
      where: { messageId },
      select: { storageKey: true },
    });
    await prisma.attachment.deleteMany({ where: { messageId } });
    await Promise.all(attachments.map((a) => deleteUpload(a.storageKey)));
    revalidatePath(`/chat/${msg.channelId}`);
  } catch (e) {
    return formError(e);
  }
}

/** Rename a group channel — any member may. */
export async function renameChannel(channelId: string, formData: FormData): Promise<FormResult> {
  const user = await requireUser();
  try {
    await assertGroupMember(channelId, user.id);
    const name = z
      .string()
      .min(1, "نام کانال الزامی است")
      .max(40, "نام کانال بیش از حد طولانی است")
      .parse(String(formData.get("name") ?? "").replace(/^#/, "").trim());
    const description =
      z.string().max(500).optional().parse(formData.get("description") || undefined) ?? null;
    await prisma.channel.update({ where: { id: channelId }, data: { name, description } });
    revalidatePath(`/chat/${channelId}`);
    revalidatePath("/chat");
  } catch (e) {
    return formError(e);
  }
}

/**
 * Delete a group channel. Allowed only if the actor's role rank is >= the
 * highest-ranked member (a member can delete an all-members group, an admin one
 * without owners, an owner any group).
 */
export async function deleteChannel(channelId: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  try {
    await assertGroupMember(channelId, user.id);
    // Read ranks + delete in one serializable tx so a concurrent promotion
    // can't sneak a higher-ranked member in between the check and the delete.
    await prisma.$transaction(
      async (tx) => {
        const members = await tx.channelMember.findMany({
          where: { channelId },
          select: { user: { select: { role: true } } },
        });
        const maxRank = Math.max(1, ...members.map((m) => roleRank(m.user.role)));
        if (roleRank(user.role) < maxRank) {
          throw new Error("برای حذف این کانال باید هم‌رتبهٔ بالاترین عضو باشید.");
        }
        await tx.channel.delete({ where: { id: channelId } });
      },
      { isolationLevel: "Serializable" }
    );
    revalidatePath("/chat");
    return { ok: true };
  } catch (e) {
    return formError(e);
  }
}

/** Add a member to a group channel — any member may add anyone. */
export async function addChannelMember(channelId: string, userId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    await assertGroupMember(channelId, user.id);
    const target = await prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!target) throw new Error("کاربر موردنظر یافت نشد.");
    // Idempotent: unique(channelId,userId) — skip if already a member.
    const existing = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!existing) {
      await prisma.channelMember.create({ data: { channelId, userId } });
    }
    revalidatePath(`/chat/${channelId}`);
  } catch (e) {
    return formError(e);
  }
}

/**
 * Remove a member from a group channel. Allowed only if the actor's role rank
 * is >= the target's (member kicks members, admin kicks admins+members, owner
 * kicks anyone). You can always remove yourself (leave).
 */
export async function removeChannelMember(channelId: string, userId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    await assertGroupMember(channelId, user.id);
    // The owner is a permanent member of every channel — nobody (not even the
    // owner) can be removed if they are the system owner.
    const ownerId = await systemOwnerId(user.id);
    if (userId === ownerId) throw new Error("مالک عضو ثابت هر کانال است و حذف نمی‌شود.");
    // Re-read the target's rank + delete atomically (serializable) so a
    // concurrent promotion can't let a lower-rank actor kick a higher one.
    await prisma.$transaction(
      async (tx) => {
        if (userId !== user.id) {
          const target = await tx.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          if (!target) throw new Error("کاربر موردنظر یافت نشد.");
          if (roleRank(user.role) < roleRank(target.role)) {
            throw new Error("اجازهٔ حذف این عضو را ندارید.");
          }
        }
        await tx.channelMember.deleteMany({ where: { channelId, userId } });
      },
      { isolationLevel: "Serializable" }
    );
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

    // The creator picks who joins. The creator and the OWNER are always
    // included (the owner is a permanent, non-deselectable member of every
    // channel); any other selected members are validated against active users.
    const activeIds = new Set(
      (await prisma.user.findMany({ where: { isActive: true }, select: { id: true } })).map(
        (u) => u.id,
      ),
    );
    const ownerId = await systemOwnerId(user.id);
    const selected = formData.getAll("members").map(String).filter((id) => activeIds.has(id));
    const memberIds = [...new Set([user.id, ownerId, ...selected])];

    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        createdById: user.id,
        members: { create: memberIds.map((id) => ({ userId: id })) },
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

/**
 * Acknowledge a task-assignment card: the recipient confirms they've seen it,
 * which stamps ackedAt, auto-posts a "seen" reply, and notifies the assigner.
 */
export async function acknowledgeTaskMessage(messageId: string): Promise<FormResult> {
  const user = await requireUser();
  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, channelId: true, senderId: true, kind: true, ackedAt: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt || msg.kind !== "TASK_ASSIGN") {
      throw new Error("پیام یافت نشد.");
    }
    await assertMember(msg.channelId, user.id);
    if (msg.senderId === user.id) {
      throw new Error("این وظیفه را شما محول کرده‌اید.");
    }
    if (msg.ackedAt) return; // already acknowledged — idempotent

    // Conditional stamp so two concurrent clicks can't both post a "seen" reply
    // + notify: only the write that still sees ackedAt=null proceeds.
    const stamped = await prisma.message.updateMany({
      where: { id: messageId, ackedAt: null },
      data: { ackedAt: new Date() },
    });
    if (stamped.count === 0) return; // someone already acknowledged
    await prisma.message.create({
      data: {
        channelId: msg.channelId,
        senderId: user.id,
        body: "✅ پیام را دیدم و در جریان وظیفه هستم.",
        replyToId: msg.id,
      },
    });
    await prisma.channelMember.updateMany({
      where: { channelId: msg.channelId, userId: user.id },
      data: { lastReadAt: new Date() },
    });
    // Let the assigner know the recipient saw it.
    try {
      await prisma.notification.create({
        data: {
          userId: msg.senderId,
          type: "MESSAGE",
          title: user.name,
          body: "وظیفهٔ محول‌شده را دید و تأیید کرد",
          href: `/chat/${msg.channelId}`,
        },
      });
    } catch (err) {
      console.error("ack notification failed", err);
    }
    revalidatePath(`/chat/${msg.channelId}`);
  } catch (e) {
    return formError(e);
  }
}
