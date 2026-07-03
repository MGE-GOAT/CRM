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

async function assertNotLastOwner(targetId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { role: true },
  });
  if (!target || target.role !== "OWNER") return;
  const activeOwners = await prisma.user.count({
    where: { role: "OWNER", isActive: true },
  });
  if (activeOwners <= 1) {
    throw new Error("نمی‌توان آخرین مالک را حذف یا غیرفعال کرد.");
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

    // Demoting an owner away from OWNER must not orphan the system.
    if (target.role === "OWNER" && nextRole !== "OWNER") {
      await assertNotLastOwner(id);
    }

    await prisma.user.update({ where: { id }, data: { role: nextRole } });
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

    // Server decides the next state (don't trust the client) and guards last owner.
    if (target.isActive) await assertNotLastOwner(id);

    await prisma.user.update({
      where: { id },
      data: { isActive: !target.isActive },
    });
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
