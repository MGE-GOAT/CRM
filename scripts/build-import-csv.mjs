// Merge parsed contacts + صنف results into a CSV the CRM importer reads directly.
// Phones go in Phone columns (importer rebuilds the "extra numbers" note itself),
// so the notes column carries only the non-phone extras (birthday/org/url).
import { readFileSync, writeFileSync } from "node:fs";

const recs = JSON.parse(readFileSync("/home/mahrad/nexus-crm/.import-contacts.json", "utf8"));
const senf = new Map(
  JSON.parse(readFileSync("/home/mahrad/nexus-crm/.senf-results.json", "utf8")).map((r) => [r.i, r.senf]),
);
const company = JSON.parse(readFileSync("/home/mahrad/nexus-crm/.company-results.json", "utf8"));

const q = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const maxPhones = Math.max(1, ...recs.map((r) => r.phones.length));
const header = [
  "First Name",
  "Last Name",
  ...Array.from({ length: maxPhones }, (_, i) => `Phone ${i + 1} - Value`),
  "E-mail 1 - Value",
  "Organization 1 - Name",
  "senf",
  "notes",
];

const lines = [header.map(q).join(",")];
for (const r of recs) {
  // Split the full descriptive name into first token + rest (matches the vCard
  // N split); display concatenates them back to the full name.
  const toks = (r.name || "").trim().split(/\s+/).filter(Boolean);
  const firstName = toks.shift() || "بدون‌نام";
  const lastName = toks.join(" ");
  // notes minus the "extra numbers" line (importer rebuilds it from phone cols)
  // and minus the junk 1970-01-01 birthdays (all 812 are placeholder epoch).
  const notesClean = (r.notes || "")
    .split("\n")
    .filter((l) => !l.startsWith("شماره‌های دیگر") && !l.startsWith("تاریخ تولد: 1970"))
    .join("\n");
  const phones = Array.from({ length: maxPhones }, (_, i) => r.phones[i] ?? "");
  lines.push(
    [firstName, lastName, ...phones, r.email ?? "", company[r.i] ?? "", senf.get(r.i) ?? "", notesClean]
      .map(q)
      .join(","),
  );
}
writeFileSync("/home/mahrad/contacts-import.csv", lines.join("\n"));
console.log(`wrote /home/mahrad/contacts-import.csv — ${recs.length} contacts, ${maxPhones} phone columns`);
