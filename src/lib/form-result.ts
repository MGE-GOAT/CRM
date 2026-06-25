import { ZodError } from "zod";

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
  if (e instanceof Error && e.message) {
    return { error: e.message };
  }
  return { error: "خطایی رخ داد. لطفاً دوباره تلاش کنید." };
}
