import { prisma } from "@/lib/prisma";

// Iran uses a fixed UTC+03:30 offset (DST abolished in 2022), so Tehran wall
// time can be derived without a tz database at runtime.
const TEHRAN_OFFSET = "+03:30";

/** Tehran Gregorian day bucket "YYYY-MM-DD" for the given instant (now by default). */
export function tehranDayKey(d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The instant of 18:00 (6pm) Tehran on the same Tehran day as `d`. */
export function sixPmTehran(d: Date = new Date()): Date {
  return new Date(`${tehranDayKey(d)}T18:00:00${TEHRAN_OFFSET}`);
}

/**
 * Record a member's first clock-in for today (idempotent — keeps the earliest
 * clock-in of the day). Called when the owner approves the member's entry.
 */
export async function recordClockIn(userId: string, at: Date = new Date()) {
  const day = tehranDayKey(at);
  await prisma.attendance.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, clockIn: at },
    update: {}, // keep the existing (earliest) clock-in
  });
}

/**
 * Record a member's clock-out for today, keeping the LATEST time of the day.
 * Used on manual logout and on auto-logout (session expiry).
 */
export async function recordClockOut(userId: string, at: Date = new Date()) {
  const day = tehranDayKey(at);
  // Single conditional write: only advance clockOut (never move it earlier),
  // and only for a day the user actually clocked in — race-safe.
  await prisma.attendance.updateMany({
    where: { userId, day, OR: [{ clockOut: null }, { clockOut: { lt: at } }] },
    data: { clockOut: at },
  });
}
