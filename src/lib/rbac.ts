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
    },
  });

  // Account deleted or deactivated since the token was issued.
  if (!user || !user.isActive) redirect("/login");

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
