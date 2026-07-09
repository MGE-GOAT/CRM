// Deterministic صنف classifier for the imported contacts.
// Tags a contact ONLY when its name contains an explicit trade keyword;
// otherwise leaves صنف blank (the "skip when unclear" rule). Keyword vocabulary
// comes from the business owner's own list + the discovery pass.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "/home/mahrad/nexus-crm/.import-contacts.json";

// Normalise Persian text: unify Arabic/Persian ya & kaf, strip ZWNJ, diacritics,
// and collapse spaces so keyword matching is robust.
function norm(s) {
  return (s || "")
    .replace(/‌/g, " ")
    .replace(/[ىي]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Category → trigger keywords (already normalised form). Ordered by priority:
// the FIRST category with a hit wins, so put specific/661 trades before generic.
const RULES = [
  ["ابزار و یراق مبل", ["ابزار مبل", "ابزارمبل", "ابزار مبلی", "ابزار فروش", "ابزارفروش", "یراق"]],
  ["کاور و روکش دوزی", ["کاور دوز", "کاوردوز", "کاور دوزی", "کاور تشک", "کاور مبل", "کاور صندلی", "کاور پتو", "روکش صندلی", "روکش مبل", "رویه کوب", "رویه کوبی", "رویکوب", "کاور", "روکش", "رویه"]],
  ["تشک و کالای خواب", ["کالای خواب", "کالا خواب", "کالاب خواب", "ایران خواب", "خوش خواب", "تشک", "بالش", "لحاف", "ندافی", "پنبه دوز", "پنبه دوزی", "زیرانداز", "زیر انداز"]],
  ["تولید ملحفه", ["ملحفه", "رول ملحفه", "کلاه اکاردونی", "کلاه اکاردئونی", "کلاه اکاردیونی"]],
  ["تولید ماسک، گان و البسه پزشکی", ["ماسک", "البسه پزشکی", "البسه تولید", "تولید البسه", "گان جراحی", "گان پزشکی", "پک جراحی", "شان جراحی", "روتختی بیمارستان", "ملحفه بیمارستان", "شورت یکبار", "کلاه جراحی", "طب "]],
  ["تولید کفش، کیف و چرم", ["زیره کفش", "زیر کفش", "تولید کفش", "تولیدی کفش", "کفاشی", "کفش دوز", "کفش زنانه", "کفش بچگانه", "تولید کیف", "کیف دوز", "ساک دستی", "کوله", " بگ", "چرم", "کفش"]],
  ["مبل و مبلمان", ["مبلمان", "مبل ساز", "مبلساز", "کالای مبل", "صندلی ساز", "میز و صندلی", "تشک مبل", "مبل", "مبلی"]],
  ["فیلتر چای و بسته بندی", ["فیلتر چای", "چای کیسه", "صافی چای", "چای", "بسته بندی", "ضربه گیر", "گونی"]],
  ["گان و لوازم آرایشگاهی", ["ارایشگاه", "آرایشگاه", "اپیلاسیون", "گان ارایش", "گان آرایش", "هدبند", "ارایشی", "آرایشی"]],
  ["سیسمونی و لوازم کودک", ["سیسمونی", "لوازم کودک", "لوازم نوزاد", "کالای کودک"]],
  ["ملزومات هتلی", ["هتل", "ملزومات هتل", "مهمانسرا", "مهمان سرا"]],
  ["کشاورزی و گلخانه", ["کشاورزی", "گلخانه", "حیاط پوشش", "پوشش گلخانه", "مالچ"]],
  ["لمینت", ["لمینت"]],
  ["پوشاک و پارچه", ["پارچه فروش", "پارچه فروشی", "پارچه", "پوشاک", "لباس زیر", "لباس مجلسی", "کت و شلوار", "مانتو", "مزون", "خیاط", "سرهمی"]],
  ["پزشکی و درمانی", ["داروخانه", "دندانپزشک", "دندان پزشک", "بیمارستان", "تجهیزات پزشکی", "کلینیک", "مطب", "درمانگاه", "فیزیوتراپ", "یونیت دندان"]],
  ["باربری و حمل و نقل", ["باربری", "وانت بار", "حمل و نقل", "باریابی", "اتوبار"]],
  ["پخش، بازرگانی و صادرات", ["بازرگانی", "پخش ", "عمده فروش", "عمده فروشی", "صادرات", "بازارگانی"]],
  ["خودرو و روکش صندلی", ["خودروساز", "خودرو ساز", "روکش صندلی خودرو", "نمایشگاه خودرو", "نمایشگاه ماشین", "لوازم یدکی", "تریم خودرو"]],
  ["املاک", ["مشاور املاک", "املاک ", "بنگاه املاک"]],
  ["تجهیزات عکاسی", ["تجهیزات عکاسی", "عکاسی", "استودیو عکس"]],
];

// TRAP guard: "پزشکی/طبی/ابی پزشکی" next to a color/number is a PRODUCT GRADE,
// not the medical trade. Only allow the medical category on strong business words.
function medicalIsReal(n) {
  return /(داروخانه|دندان|بیمارستان|تجهیزات پزشکی|کلینیک|مطب|درمانگاه|فیزیوتراپ|یونیت دندان)/.test(n);
}

// Multi-word / longer keywords match as substrings; short bare stems (مبل، کفش،
// کاور…) match only as whole tokens or token-prefixes, so we don't hit e.g.
// کیفیت via کیف or مبلغ via مبل.
function hit(n, kw, tokens) {
  if (kw.includes(" ") || kw.length > 4) return n.includes(kw);
  return tokens.some((t) => t === kw || t.startsWith(kw));
}

const recs = JSON.parse(readFileSync(SRC, "utf8"));
const out = [];
const counts = {};
for (const r of recs) {
  const n = norm(r.name);
  const tokens = n.split(" ");
  let senf = "";
  for (const [cat, kws] of RULES) {
    if (kws.some((k) => hit(n, k, tokens))) {
      if (cat === "پزشکی و درمانی" && !medicalIsReal(n)) continue; // color-trap guard
      senf = cat;
      break;
    }
  }
  out.push({ i: r.i, senf });
  counts[senf || "— (skip)"] = (counts[senf || "— (skip)"] || 0) + 1;
}

writeFileSync("/home/mahrad/nexus-crm/.senf-results.json", JSON.stringify(out));
const tagged = out.filter((o) => o.senf).length;
console.log(`classified ${recs.length} → tagged ${tagged} (${((tagged / recs.length) * 100).toFixed(1)}%), skipped ${recs.length - tagged}\n`);
console.log("distribution (most → least):");
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(5)}  ${k}`);
}
