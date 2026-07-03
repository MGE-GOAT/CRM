// Convert an integer amount to Persian words (e.g. for «مبلغ به حروف» on invoices).
// Handles 0 up to the hundreds-of-billions range, which is ample for Toman amounts.

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = [
  "ده", "یازده", "دوازده", "سیزده", "چهارده",
  "پانزده", "شانزده", "هفده", "هجده", "نوزده",
];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = [
  "", "صد", "دویست", "سیصد", "چهارصد",
  "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد",
];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد"];

/** Words for a 0–999 group. */
function threeDigitToWords(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest <= 19) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t > 0) parts.push(TENS[t]);
    if (o > 0) parts.push(ONES[o]);
  }
  return parts.join(" و ");
}

/** Convert a non-negative integer to Persian words. Returns «صفر» for 0. */
export function toPersianWords(value: number): string {
  // Guard against Infinity/NaN (e.g. a "1e400" invoice input) — an unguarded
  // `while (n > 0)` on a non-finite n never terminates and freezes the tab.
  if (!Number.isFinite(value)) return "صفر";
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    const words = threeDigitToWords(groups[i]);
    const scale = SCALES[i] ?? "";
    parts.push(scale ? `${words} ${scale}` : words);
  }
  return parts.join(" و ");
}
