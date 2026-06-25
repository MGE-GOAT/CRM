import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import { ChatThread, type ChatMsg } from "@/components/chat/chat-thread";
import { markChannelRead } from "@/lib/actions/chat";
import { formatNumber } from "@/lib/format";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await requireUser();

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: user.id } },
  });
  if (!membership) notFound();

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, avatarColor: true } } },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        include: {
          sender: { select: { id: true, name: true, avatarColor: true } },
          replyTo: { include: { sender: { select: { name: true } } } },
        },
      },
    },
  });
  if (!channel) notFound();

  await markChannelRead(channelId);

  const other = channel.isDirect
    ? channel.members.find((m) => m.user.id !== user.id)?.user
    : undefined;
  const title = channel.isDirect ? other?.name ?? "پیام مستقیم" : channel.name;

  const messages: ChatMsg[] = channel.messages.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    senderId: m.senderId,
    senderName: m.sender.name,
    senderColor: m.sender.avatarColor,
    replyToName: m.replyTo?.sender.name ?? null,
    replyToBody: m.replyTo?.body ?? null,
  }));

  return (
    <div className="flex h-full flex-col">
      <AutoRefresh />
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-4">
        <Link
          href="/chat"
          aria-label="بازگشت به کانال‌ها"
          className="-ms-1 rounded-lg p-1 text-muted hover:bg-gray-50 md:hidden"
        >
          <ChevronLeft size={20} aria-hidden="true" className="rotate-180" />
        </Link>
        {channel.isDirect ? (
          <Avatar name={title} color={other?.avatarColor ?? "#9a7b0a"} size={28} />
        ) : (
          <Hash size={18} className="text-muted" aria-hidden="true" />
        )}
        <div>
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {!channel.isDirect && (
            <p className="text-xs text-muted">
              {formatNumber(channel.members.length)} عضو
              {channel.description ? ` · ${channel.description}` : ""}
            </p>
          )}
        </div>
      </div>

      <ChatThread channelId={channelId} currentUserId={user.id} messages={messages} />
    </div>
  );
}
