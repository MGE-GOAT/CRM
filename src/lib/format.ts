// Persian (fa-IR) formatting helpers: Persian numerals, Toman currency,
// and Jalali (Shamsi) dates. Dates are stored as UTC; only display is localized.

const FA_LOCALE = "fa-IR";

/** Convert any ASCII digits in a string to Persian numerals. */
export function toFa(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

/** Convert Persian/Arabic digits in a string to ASCII (for parsing input). */
export function toEn(input: string): string {
  return String(input)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Parse a user-typed amount (Persian or English digits, with separators) to a number. */
export function parseAmount(input: string): number {
  const cleaned = toEn(input).replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Normalize a phone to an international number for wa.me (no +). Assumes Iran (98). */
export function toWhatsappNumber(phone: string): string {
  let d = toEn(phone).replace(/\D/g, "");
  if (d.startsWith("0098")) d = d.slice(2); // drop the "00", keep the 98 country code
  else if (d.startsWith("98")) d = d;
  else if (d.startsWith("0")) d = "98" + d.slice(1);
  return d;
}

/** Normalize an Iranian mobile to local format (09xxxxxxxxx) for SMS gateways. */
export function toLocalIranPhone(phone: string): string {
  let d = toEn(phone).replace(/\D/g, "");
  if (d.startsWith("0098")) d = d.slice(4);
  else if (d.startsWith("98")) d = d.slice(2);
  if (!d.startsWith("0")) d = "0" + d;
  return d;
}

/** Format a number with Persian numerals and grouping (۱۲٬۵۰۰). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(FA_LOCALE).format(n);
}

/** Amount in ریال (the app-wide currency), Persian numerals (۱۲٬۵۰۰٬۰۰۰ ریال). */
export function formatRial(value: number): string {
  return `${formatNumber(Math.round(value))} ریال`;
}

/** Percentage with Persian numerals (۸۵٪). */
export function formatPercent(n: number): string {
  return `${formatNumber(n)}٪`;
}

/** Jalali date, medium style: ۱ دی ۱۴۰۳ */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat(FA_LOCALE, {
    calendar: "persian",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

/** Jalali date + time: ۱ دی ۱۴۰۳، ۱۴:۳۰ */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat(FA_LOCALE, {
    calendar: "persian",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Just the time: ۱۴:۳۰ */
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat(FA_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Relative time in Persian (هم‌اکنون / ۵ دقیقه پیش / دیروز …). */
export function formatRelative(date: Date | string): string {
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "هم‌اکنون";
  if (mins < 60) return `${toFa(mins)} دقیقه پیش`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${toFa(hrs)} ساعت پیش`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "دیروز";
  if (days < 7) return `${toFa(days)} روز پیش`;
  return formatDate(d);
}

/** Day label for chat dividers: امروز / دیروز / ۱ دی ۱۴۰۳ */
export function formatDayLabel(date: Date | string): string {
  const d = new Date(date);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (dayDiff === 0) return "امروز";
  if (dayDiff === 1) return "دیروز";
  return formatDate(d);
}

/** YYYY-MM-DD (Gregorian) key for grouping messages by calendar day. */
export function dayKey(date: Date | string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
