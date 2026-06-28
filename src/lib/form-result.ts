import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/**
 * Result returned by form server actions. Errors are RETURNED (not thrown)
 * because Next.js redacts thrown error messages in production — returned
 * values are serialized to the client intact, so the user sees the real reason.
 */
export type FormResult = { error?: string } | void;

/** Maps a thrown error to a user-facing Persian message. */
export function formError(e: unknown): { error: string } {
  if (e instanceof ZodError) {
    return { error: e.issues[0]?.message ?? "ورودی نامعتبر است." };
  }
  // Never surface raw Prisma errors (they leak schema/field/host details).
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return { error: "این مقدار قبلاً ثبت شده است." };
    if (e.code === "P2025") return { error: "رکورد موردنظر یافت نشد." };
    return { error: "خطای پایگاه داده." };
  }
  if (
    e instanceof Prisma.PrismaClientValidationError ||
    e instanceof Prisma.PrismaClientInitializationError ||
    e instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return { error: "خطای پایگاه داده. لطفاً دوباره تلاش کنید." };
  }
  // Our own intentional throws use plain Error with a Persian message.
  if (e instanceof Error && e.message) {
    return { error: e.message };
  }
  return { error: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
}
