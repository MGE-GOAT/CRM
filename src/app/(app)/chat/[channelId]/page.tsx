import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash, ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, roleRank } from "@/lib/rbac";
import { Avatar } from "@/components/ui/avatar";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import { ChatThread, type ChatMsg } from "@/components/chat/chat-thread";
import { GroupManage, type MemberInfo } from "@/components/chat/group-manage";
import { markChannelRead } from "@/lib/actions/chat";
import { chatMessageInclude, toChatMsg } from "@/lib/chat-message";
import { formatNumber } from "@/lib/format";

const INITIAL_WINDOW = 200;

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
        include: { user: { select: { id: true, name: true, avatarColor: true, role: true } } },
        orderBy: { joinedAt: "asc" },
      },
      messages: {
        // Newest window, still in chronological order: a negative take returns
        // the LAST N rows of the ordering — so channels past the window keep
        // showing new messages. Older ones load on scroll-up (loadOlderMessages).
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: -INITIAL_WINDOW,
        include: chatMessageInclude,
      },
    },
  });
  if (!channel) notFound();

  await markChannelRead(channelId);

  const other = channel.isDirect
    ? channel.members.find((m) => m.user.id !== user.id)?.user
    : undefined;
  const title = channel.isDirect ? other?.name ?? "پیام مستقیم" : channel.name;
  const canModerate = canManageUsers(user.role);
  // Any member may manage a group; per-member kick / group-delete are gated by
  // role rank inside GroupManage + the server actions.
  const canManageGroup = !channel.isDirect;
  const myRank = roleRank(user.role);
  const maxMemberRank = Math.max(
    1,
    ...channel.members.map((m) => roleRank(m.user.role))
  );
  const canDeleteGroup = canManageGroup && myRank >= maxMemberRank;

  const messages: ChatMsg[] = channel.messages.map(toChatMsg);
  // A full window means there are likely older messages to scroll back to.
  const hasOlder = channel.messages.length >= INITIAL_WINDOW;

  const members: MemberInfo[] = channel.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    avatarColor: m.user.avatarColor,
    isCreator: m.user.id === channel.createdById,
    // Actor may kick this member if their rank is >= the member's — but the
    // OWNER is a permanent member of every channel and can't be removed.
    removable: m.user.role !== "OWNER" && myRank >= roleRank(m.user.role),
  }));

  // Active users not yet in the channel — candidates to add.
  const candidates = canManageGroup
    ? await prisma.user.findMany({
        where: {
          isActive: true,
          id: { notIn: channel.members.map((m) => m.user.id) },
        },
        select: { id: true, name: true, avatarColor: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AutoRefresh />
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border bg-surface px-4">
        <Link
          href="/chat"
          aria-label="بازگشت به کانال‌ها"
          className="-ms-1 rounded-lg p-1 text-muted hover:bg-[var(--gold-tint)] md:hidden"
        >
          <ChevronLeft size={20} aria-hidden="true" className="rotate-180" />
        </Link>
        {channel.isDirect ? (
          <Avatar name={title} color={other?.avatarColor ?? "#9a7b0a"} size={28} />
        ) : (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--gold-tint)] text-[color:var(--gold-ink)]"
            aria-hidden="true"
          >
            <Hash size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold leading-tight tracking-tight text-text">
            {title}
          </h2>
          {!channel.isDirect && (
            <p className="truncate text-xs text-muted">
              {formatNumber(channel.members.length)} عضو
              {channel.description ? ` · ${channel.description}` : ""}
            </p>
          )}
        </div>
        {!channel.isDirect && (
          <div className="ms-auto">
            <GroupManage
              channelId={channelId}
              name={channel.name}
              description={channel.description}
              members={members}
              candidates={candidates}
              currentUserId={user.id}
              canManage={canManageGroup}
              canDelete={canDeleteGroup}
            />
          </div>
        )}
      </div>

      <ChatThread
        key={channelId}
        channelId={channelId}
        currentUserId={user.id}
        canModerate={canModerate}
        messages={messages}
        hasOlder={hasOlder}
      />
    </div>
  );
}
