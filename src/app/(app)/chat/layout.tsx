import { prisma } from "@/lib/prisma";
import { requireUser, systemOwnerId } from "@/lib/rbac";
import { ChannelSidebar } from "@/components/chat/channel-sidebar";
import { ChatShell } from "@/components/chat/chat-shell";
import { createChannel, startDirectMessage } from "@/lib/actions/chat";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  const memberships = await prisma.channelMember.findMany({
    where: { userId: user.id },
    include: {
      channel: {
        include: {
          members: {
            include: { user: { select: { id: true, name: true, avatarColor: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
    },
  });

  // compute unread counts
  const channels = await Promise.all(
    memberships.map(async (m) => {
      const unread = await prisma.message.count({
        where: {
          channelId: m.channelId,
          createdAt: { gt: m.lastReadAt },
          senderId: { not: user.id },
          deletedAt: null, // a since-deleted message must not keep the badge lit
        },
      });
      const other = m.channel.isDirect
        ? m.channel.members.find((mem) => mem.user.id !== user.id)?.user
        : undefined;
      return {
        id: m.channel.id,
        name: m.channel.isDirect ? other?.name ?? "پیام مستقیم" : m.channel.name,
        isDirect: m.channel.isDirect,
        otherColor: other?.avatarColor,
        unread,
        lastAt: m.channel.messages[0]?.createdAt ?? m.channel.createdAt,
      };
    })
  );

  channels.sort((a, b) => +new Date(b.lastAt) - +new Date(a.lastAt));

  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: user.id } },
    select: { id: true, name: true, avatarColor: true },
    orderBy: { name: "asc" },
  });

  const ownerId = await systemOwnerId(user.id);

  return (
    <ChatShell
      sidebar={
        <ChannelSidebar
          channels={channels}
          users={users}
          ownerId={ownerId}
          createChannel={createChannel}
          startDirectMessage={startDirectMessage}
        />
      }
    >
      {children}
    </ChatShell>
  );
}
