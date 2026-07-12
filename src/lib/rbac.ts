import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
};

/**
 * Returns the current user, re-validated against the database on every call.
 * Runs in the Node runtime (server components / server actions), so a user who
 * is disabled or whose role changed is enforced on their next request — without
 * waiting for the JWT to expire. Redirects to the entry panel otherwise.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      isActive: true,
      approvedUntil: true,
    },
  });

  // Account deleted or deactivated since the token was issued.
  if (!user || !user.isActive) redirect("/login");

  // Members need an active owner-approved window; owner/admin are exempt. An
  // expired member is auto-logged-out (clocked out at their session end).
  if (user.role === "MEMBER") {
    const until = user.approvedUntil;
    const approved = !!until && until.getTime() > Date.now();
    if (!approved) {
      if (until) {
        const { recordClockOut } = await import("@/lib/attendance");
        try {
          await recordClockOut(user.id, until);
        } catch {
          /* non-fatal */
        }
      }
      redirect("/pending");
    }
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
  };
}

/** Returns the DB-validated user, or null — never redirects. For the login page. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, avatarColor: true, isActive: true },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
  };
}

/**
 * Like getSessionUser, but ALSO enforces the member approval window — returns
 * null for a pending or expired MEMBER. Use in API route handlers (which can't
 * redirect) so they don't leak data to un-approved members. Owner/admin exempt.
 */
export async function getApprovedSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarColor: true,
      isActive: true,
      approvedUntil: true,
    },
  });
  if (!user || !user.isActive) return null;
  if (user.role === "MEMBER") {
    if (!user.approvedUntil || user.approvedUntil.getTime() <= Date.now()) return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarColor: user.avatarColor,
  };
}

/** Requires one of the given roles (re-checked against the DB), else redirects home. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export function canManageUsers(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export function isOwner(role: Role) {
  return role === "OWNER";
}

/**
 * Numeric rank for hierarchical actions (e.g. chat group moderation): a user
 * may act on peers of equal or lower rank. OWNER=3 > ADMIN=2 > MEMBER=1.
 */
export function roleRank(role: Role): number {
  return role === "OWNER" ? 3 : role === "ADMIN" ? 2 : 1;
}

/**
 * The single account that owns all CRM data. Per policy, members and admins own
 * nothing — every contact/company/deal belongs to the OWNER. Resolves the
 * primary (oldest active) OWNER; falls back to the acting user only if somehow
 * no OWNER exists (fresh DB before bootstrap).
 */
export async function systemOwnerId(fallbackUserId: string): Promise<string> {
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? fallbackUserId;
}
