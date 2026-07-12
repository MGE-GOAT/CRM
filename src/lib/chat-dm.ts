import { prisma } from "@/lib/prisma";

/**
 * Find (or create) the 1:1 direct-message channel between two users and return
 * its id. Shared by the chat "start DM" action and the task-assignment card
 * flow. Not a server action — a plain helper called only from trusted server
 * code with already-validated user ids.
 *
 * KNOWN LIMITATION: find-then-create isn't atomic, so two simultaneous calls
 * for the same pair can create duplicate DM channels. Low risk for a small
 * team; a proper fix would add a unique sorted-pair key column on Channel.
 */
export async function getOrCreateDirectChannel(
  userAId: string,
  userBId: string
): Promise<string> {
  const candidates = await prisma.channel.findMany({
    where: {
      isDirect: true,
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
    include: { _count: { select: { members: true } } },
  });
  const existing = candidates.find((c) => c._count.members === 2);
  if (existing) return existing.id;

  const other = await prisma.user.findUnique({
    where: { id: userBId },
    select: { name: true },
  });
  const channel = await prisma.channel.create({
    data: {
      name: other?.name ?? "پیام مستقیم",
      isDirect: true,
      createdById: userAId,
      members: { create: [{ userId: userAId }, { userId: userBId }] },
    },
  });
  return channel.id;
}
