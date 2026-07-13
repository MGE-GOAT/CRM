import type { Prisma } from "@prisma/client";
import type { ChatMsg } from "@/components/chat/chat-thread";

/** Relations every message needs to render in the thread. */
export const chatMessageInclude = {
  sender: { select: { id: true, name: true, avatarColor: true } },
  replyTo: { include: { sender: { select: { name: true } } } },
  attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
} as const;

type MessageWithRels = Prisma.MessageGetPayload<{ include: typeof chatMessageInclude }>;

/** Map a Prisma message (with chatMessageInclude) to the client ChatMsg shape. */
export function toChatMsg(m: MessageWithRels): ChatMsg {
  return {
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    deleted: m.deletedAt !== null,
    kind: m.kind,
    acked: m.ackedAt !== null,
    factorId: m.factorId,
    senderId: m.senderId,
    senderName: m.sender.name,
    senderColor: m.sender.avatarColor,
    replyToName: m.replyTo?.sender.name ?? null,
    replyToBody: m.replyTo?.body ?? null,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
    })),
  };
}
