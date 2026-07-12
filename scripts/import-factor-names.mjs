// Match customers from the "سامانه فاکتور آنلاین" export against existing
// contacts by phone number, and fill in each matched contact's `factorName`
// (the customer-facing official name shown on invoices) and address.
//
// Usage:  node scripts/import-factor-names.mjs <path-to.xlsx> [--commit]
// Without --commit it runs as a dry run and only prints what it would change.
//
// Excel columns (sheet1): B = name, C = phone, H = address.

import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const xlsxPath = process.argv[2];
const commit = process.argv.includes("--commit");
if (!xlsxPath) {
  console.error("Usage: node scripts/import-factor-names.mjs <path-to.xlsx> [--commit]");
  process.exit(1);
}

/** Last 10 digits of an Iranian number — robust across 0/+98/98 prefixes. */
function phoneKey(raw) {
  const d = String(raw ?? "")
    .replace(/[۰-۹]/g, (x) => "۰۱۲۳۴۵۶۷۸۹".indexOf(x))
    .replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
}

// --- Parse the worksheet XML (inline strings) via jszip (no external unzip) ---
const zip = await JSZip.loadAsync(readFileSync(xlsxPath));
const sheet = zip.file("xl/worksheets/sheet1.xml");
if (!sheet) {
  console.error("xl/worksheets/sheet1.xml not found in the workbook.");
  process.exit(1);
}
const xml = await sheet.async("string");

const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
// Attribute order varies (t may precede r), so capture the whole tag then read attrs.
const cellRe = /<c ([^>]*?)>([\s\S]*?)<\/c>/g;
const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
};

function cellText(inner, type) {
  if (type === "inlineStr") {
    return [...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((m) => m[1])
      .join("")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }
  const v = inner.match(/<v>([\s\S]*?)<\/v>/);
  return v ? v[1] : "";
}

const rows = [];
let rm;
while ((rm = rowRe.exec(xml))) {
  const cells = {};
  let cm;
  while ((cm = cellRe.exec(rm[1]))) {
    const ref = attr(cm[1], "r"); // e.g. "B3"
    const col = ref.replace(/\d+/g, "");
    if (col) cells[col] = cellText(cm[2], attr(cm[1], "t"));
  }
  rows.push(cells);
}

// Columns: B=name, C=phone, D=economicCode, E=nationalId, F=registrationNumber,
// G=postalCode, H=address. Build phone -> record (keep first occurrence).
const byPhone = new Map();
for (const c of rows) {
  const key = phoneKey(c.C);
  const name = (c.B ?? "").trim();
  if (!key || !name) continue;
  if (!byPhone.has(key))
    byPhone.set(key, {
      name,
      address: (c.H ?? "").trim(),
      economicCode: (c.D ?? "").trim(),
      nationalId: (c.E ?? "").trim(),
      registrationNumber: (c.F ?? "").trim(),
      postalCode: (c.G ?? "").trim(),
    });
}
console.log(`Parsed ${byPhone.size} unique customers with a phone from the export.`);

// --- Match against existing contacts ---
const contacts = await prisma.contact.findMany({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    factorName: true,
    notes: true,
    economicCode: true,
    nationalId: true,
    registrationNumber: true,
    postalCode: true,
  },
});

let matched = 0;
let updated = 0;
for (const ct of contacts) {
  const key = phoneKey(ct.phone);
  if (!key) continue;
  const hit = byPhone.get(key);
  if (!hit) continue;
  matched++;

  const data = {};
  if (!ct.factorName && hit.name) data.factorName = hit.name;
  if (!ct.notes && hit.address) data.notes = hit.address;
  if (!ct.economicCode && hit.economicCode) data.economicCode = hit.economicCode;
  if (!ct.nationalId && hit.nationalId) data.nationalId = hit.nationalId;
  if (!ct.registrationNumber && hit.registrationNumber)
    data.registrationNumber = hit.registrationNumber;
  if (!ct.postalCode && hit.postalCode) data.postalCode = hit.postalCode;
  if (Object.keys(data).length === 0) continue;

  console.log(
    `  ${ct.firstName} ${ct.lastName} (${ct.phone}) → factorName="${data.factorName ?? ct.factorName ?? ""}"` +
      (data.notes ? ` +address(${data.notes.length} chars)` : "")
  );
  if (commit) {
    await prisma.contact.update({ where: { id: ct.id }, data });
    updated++;
  }
}

console.log(
  `\nMatched ${matched} contacts by phone. ${commit ? `Updated ${updated}.` : "Dry run — pass --commit to apply."}`
);
await prisma.$disconnect();
