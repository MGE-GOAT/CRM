import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { jalaliMonthKey } from "@/lib/factor";

/**
 * Report months are **Jalali** "YYYY-MM" (matching how Iranian users think and
 * how factor numbers reset), converted to Gregorian instant ranges for
 * filtering DateTime columns. `DateObject.toDate()` yields local midnight — the
 * server runs on Asia/Tehran, so that's the correct Tehran month boundary.
 */

/** Current Jalali month bucket "YYYY-MM" (Tehran). */
export function currentTehranMonth(): string {
  return jalaliMonthKey();
}

/** Validate a Jalali "YYYY-MM" (month 01–12); fall back to the current month. */
export function normalizeMonth(month: string | undefined): string {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const mon = Number(month.slice(5, 7));
    if (mon >= 1 && mon <= 12) return month;
  }
  return currentTehranMonth();
}

/** Gregorian instant of the first day of a Jalali year-month. */
function jalaliMonthStart(year: number, mon: number): Date {
  return new DateObject({ calendar: persian, year, month: mon, day: 1 }).toDate();
}

/** Half-open Gregorian instant range [start, end) covering the Jalali month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  const start = jalaliMonthStart(year, mon);
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  const end = jalaliMonthStart(nextYear, nextMon);
  return { start, end };
}

/** The last `count` Jalali months, newest first, as "YYYY-MM" keys. */
export function recentMonths(count: number): string[] {
  const [y0, m0] = currentTehranMonth().split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const total = y0 * 12 + (m0 - 1) - i;
    const year = Math.floor(total / 12);
    const mon = (total % 12) + 1;
    out.push(`${year}-${String(mon).padStart(2, "0")}`);
  }
  return out;
}

/** Farsi label for a Jalali "YYYY-MM", e.g. "تیر ۱۴۰۴". */
export function formatMonthLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return new DateObject({
    calendar: persian,
    locale: persian_fa,
    year,
    month: mon,
    day: 1,
  }).format("MMMM YYYY");
}
