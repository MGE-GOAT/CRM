"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { formError, type FormResult } from "@/lib/form-result";
import { enforceRateLimit } from "@/lib/rate-limit";

// Cost factor for new password hashes (existing lower-cost hashes still verify).
const BCRYPT_COST = 12;

const PALETTE = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6", "#ef4444"];

const roleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
const passwordSchema = z
  .string()
  .min(8, "گذرواژه باید حداقل ۸ کاراکتر باشد")
  .regex(/[A-Za-z]/, "گذرواژه باید حداقل یک حرف انگلیسی داشته باشد")
  .regex(/[0-9]/, "گذرواژه باید حداقل یک عدد انگلیسی داشته باشد");

const createSchema = z.object({
  name: z.string().min(1, "نام الزامی است"),
  email: z.string().email("ایمیل معتبر وارد کنید"),
  password: passwordSchema,
  role: roleSchema,
});

/** Owners may manage anyone; Admins may not create/modify/target Owners. */
function assertCanManageRole(callerRole: Role, targetRole: Role, nextRole?: Role) {
  if (callerRole === "OWNER") return;
  // caller is ADMIN
  if (targetRole === "OWNER" || nextRole === "OWNER") {
    throw new Error("فقط مالک می‌تواند حساب‌های مالک را مدیریت کند.");
  }
}

export async function createUser(formData: FormData): Promise<FormResult> {
  const caller = await requireRole("OWNER", "ADMIN");
  try {
    enforceRateLimit(`users:create:${caller.id}`, 20, 60 * 1000);
    const d = createSchema.parse({
      name: formData.get("name"),
      email: String(formData.get("email") ?? "").toLowerCase().trim(),
      password: formData.get("password"),
      role: formData.get("role") || "MEMBER",
    });

    assertCanManageRole(caller.role, "MEMBER", d.role);

    const existing = await prisma.user.findUnique({ where: { email: d.email } });
    if (existing) throw new Error("کاربری با این ایمیل قبلاً ثبت شده است.");

    const passwordHash = await bcrypt.hash(d.password, BCRYPT_COST);
    await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        passwordHash,
        role: d.role,
        avatarColor: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      },
    });
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}

export async function updateUserRole(id: string, role: string): Promise<FormResult> {
  const caller = await requireRole("OWNER", "ADMIN");
  try {
    const nextRole = roleSchema.parse(role);
    if (id === caller.id) throw new Error("نمی‌توانید نقش خود را تغییر دهید.");

    const target = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });
    assertCanManageRole(caller.role, target.role, nextRole);

    // Demoting an owner away from OWNER must not orphan the system. Apply +
    // re-check atomically (serializable) so concurrent demotions can't both win.
    if (target.role === "OWNER" && nextRole !== "OWNER") {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({ where: { id }, data: { role: nextRole } });
          const remaining = await tx.user.count({ where: { role: "OWNER", isActive: true } });
          if (remaining < 1) throw new Error("نمی‌توان آخرین مالک را حذف یا غیرفعال کرد.");
        },
        { isolationLevel: "Serializable" },
      );
    } else {
      await prisma.user.update({ where: { id }, data: { role: nextRole } });
    }
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}

export async function toggleUserActive(id: string): Promise<FormResult> {
  const caller = await requireRole("OWNER", "ADMIN");
  try {
    if (id === caller.id) throw new Error("نمی‌توانید حساب خود را غیرفعال کنید.");

    const target = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { role: true, isActive: true },
    });
    assertCanManageRole(caller.role, target.role);

    const nextActive = !target.isActive;
    // Deactivating an owner: apply then re-check inside one serializable
    // transaction so two owners deactivating each other at once can't both
    // succeed and orphan the system (last-owner guard is now atomic).
    if (!nextActive && target.role === "OWNER") {
      await prisma.$transaction(
        async (tx) => {
          await tx.user.update({ where: { id }, data: { isActive: false, deactivatedAt: new Date() } });
          const remaining = await tx.user.count({ where: { role: "OWNER", isActive: true } });
          if (remaining < 1) throw new Error("نمی‌توان آخرین مالک را حذف یا غیرفعال کرد.");
        },
        { isolationLevel: "Serializable" },
      );
    } else {
      await prisma.user.update({
        where: { id },
        // Stamp the deactivation time (cleared on reactivate) so the purge job
        // can auto-delete accounts that stay deactivated past the grace window.
        data: { isActive: nextActive, deactivatedAt: nextActive ? null : new Date() },
      });
    }
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}

export async function resetUserPassword(id: string, formData: FormData): Promise<FormResult> {
  const caller = await requireRole("OWNER", "ADMIN");
  try {
    enforceRateLimit(`users:resetpw:${caller.id}`, 20, 60 * 1000);
    const password = passwordSchema.parse(formData.get("password"));

    const target = await prisma.user.findUniqueOrThrow({
      where: { id },
      select: { role: true },
    });
    assertCanManageRole(caller.role, target.role);

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}

/**
 * approveMember — OWNER only. Approves a pending member's login for a session
 * ending at `untilTime` (HH:MM Tehran) or, by default, 6pm Tehran today. The
 * end time must be in the future (after 6pm the owner supplies a custom time).
 * Records the member's clock-in and notifies them.
 */
export async function approveMember(
  userId: string,
  untilTime?: string
): Promise<FormResult> {
  const owner = await requireRole("OWNER");
  try {
    const { sixPmTehran, tehranDayKey, recordClockIn } = await import("@/lib/attendance");
    const target = await prisma.user.findFirst({
      where: { id: userId, isActive: true, role: "MEMBER" },
      select: { id: true },
    });
    if (!target) throw new Error("کاربر معتبر نیست.");

    let until: Date;
    if (untilTime) {
      // Owner typed a specific end time — an explicitly-past one is an error.
      if (!/^\d{2}:\d{2}$/.test(untilTime)) throw new Error("ساعت نامعتبر است.");
      until = new Date(`${tehranDayKey()}T${untilTime}:00+03:30`);
      if (until.getTime() <= Date.now()) {
        throw new Error("زمان پایان باید در آینده باشد.");
      }
    } else {
      // Default: valid until 6pm Tehran during work hours. If 6pm has already
      // passed (after-hours approval), grant a short 1-hour window instead of
      // blocking the owner — they can still type a specific time for longer.
      until = sixPmTehran();
      if (until.getTime() <= Date.now()) {
        until = new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: { approvedUntil: until, pendingSince: null, approvedById: owner.id },
    });
    await recordClockIn(userId);
    await prisma.notification.create({
      data: {
        userId,
        type: "TASK",
        title: "ورود تأیید شد",
        body: "دسترسی شما فعال شد.",
        href: "/",
      },
    });
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}

/** dismissJoinRequest — OWNER only. Clears a pending request without approving. */
export async function dismissJoinRequest(userId: string): Promise<FormResult> {
  await requireRole("OWNER");
  try {
    await prisma.user.updateMany({
      where: { id: userId, role: "MEMBER" },
      data: { pendingSince: null },
    });
    revalidatePath("/settings/users");
  } catch (e) {
    return formError(e);
  }
}
