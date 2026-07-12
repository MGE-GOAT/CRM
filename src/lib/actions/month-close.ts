"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { formError, type FormResult } from "@/lib/form-result";
import { normalizeMonth } from "@/lib/attendance-report";
import { closeMonth } from "@/lib/monthly-backup";

/**
 * OWNER-only: back up a completed month, then purge its live factors +
 * attendance. The backup is stored (MonthlyArchive) and stays downloadable.
 * Only past months can be closed — the current month is never touched.
 */
export async function closeMonthAction(month: string): Promise<FormResult> {
  const user = await requireRole("OWNER");
  try {
    const m = normalizeMonth(month);
    const res = await closeMonth(m, user.id);
    if (!res.archived) throw new Error(res.reason ?? "این ماه بسته نشد.");
    revalidatePath("/");
    revalidatePath("/factors");
  } catch (e) {
    return formError(e);
  }
}
