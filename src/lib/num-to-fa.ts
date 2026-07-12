// Persian number-to-words for Rial invoice amounts (به حروف).
// Handles non-negative integers up to the billions range typical for factors.

const ONES = [
  "",
  "یک",
  "دو",
  "سه",
  "چهار",
  "پنج",
  "شش",
  "هفت",
  "هشت",
  "نه",
];

const TEENS = [
  "ده",
  "یازده",
  "دوازده",
  "سیزده",
  "چهارده",
  "پانزده",
  "شانزده",
  "هفده",
  "هجده",
  "نوزده",
];

const TENS = [
  "",
  "",
  "بیست",
  "سی",
  "چهل",
  "پنجاه",
  "شصت",
  "هفتاد",
  "هشتاد",
  "نود",
];

const HUNDREDS = [
  "",
  "صد",
  "دویست",
  "سیصد",
  "چهارصد",
  "پانصد",
  "ششصد",
  "هفتصد",
  "هشتصد",
  "نهصد",
];

// Scale words per group of three digits (index = group position).
const SCALES = ["", "هزار", "میلیون", "میلیارد", "هزار میلیارد", "میلیون میلیارد"];

/** Words for a 0–999 group. Returns "" for 0. */
function groupToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens > 0) parts.push(TENS[tens]);
    if (ones > 0) parts.push(ONES[ones]);
  }
  return parts.join(" و ");
}

/**
 * Persian words for a non-negative integer amount, suffixed with «ریال».
 * e.g. 576000000 → «پانصد و هفتاد و شش میلیون ریال».
 */
export function numberToPersianWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "صفر ریال";
  // Beyond the supported scale (and past JS safe-integer precision) — fall back
  // to grouped Farsi digits so we can never emit a wrong words value.
  if (n >= 1e18) return `${n.toLocaleString("fa-IR")} ریال`;

  // Split into groups of three digits, least-significant first.
  const groups: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const segments: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const words = groupToWords(g);
    const scale = SCALES[i] ?? "";
    segments.push(scale ? `${words} ${scale}` : words);
  }

  return `${segments.join(" و ")} ریال`;
}
