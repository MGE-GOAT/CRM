// Parse contacts from an iPhone/iCloud vCard (.vcf) export or a CSV file into a
// flat shape the CRM can bulk-insert. Handles the real-world messiness of iOS
// exports: vCard 2.1 + 3.0, line folding, and QUOTED-PRINTABLE encoding (which
// iPhones commonly use for Persian/non-ASCII names).

export type ParsedContact = {
  firstName: string;
  lastName: string;
  phone: string; // primary number
  phones: string[]; // ALL numbers (primary first) — nothing dropped
  email: string;
  title: string;
  company: string;
  senf: string; // business category (from a CSV column; empty for vCard)
  notes: string; // extra phones, birthday, org, url, and any NOTE — so nothing is lost
};

/** Decode a QUOTED-PRINTABLE value (=XX byte sequences) as UTF-8. */
function decodeQuotedPrintable(v: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < v.length; i++) {
    if (v[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(v.substr(i + 1, 2))) {
      bytes.push(parseInt(v.substr(i + 1, 2), 16));
      i += 2;
    } else {
      bytes.push(v.charCodeAt(i) & 0xff);
    }
  }
  try {
    return Buffer.from(bytes).toString("utf8");
  } catch {
    return v;
  }
}

function cleanPhone(v: string): string {
  return v.replace(/[^\d+\-() ]/g, "").trim();
}

/** Hard ceiling on parsed contacts — bounds memory regardless of file size. */
export const MAX_CONTACTS = 10000;

function parseVcard(text: string, cap: number): ParsedContact[] {
  // Normalise line endings, drop QUOTED-PRINTABLE soft line breaks (= at EOL),
  // then unfold folded continuation lines (RFC: a line starting with SPACE/TAB
  // continues the previous one).
  const unfolded = text
    .replace(/\r\n?/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\n[ \t]/g, "");

  // split(limit) bounds the array so a huge file can't materialise millions of
  // card strings, and the loop stops at `cap` so the output array is bounded too.
  const cards = unfolded.split(/BEGIN:VCARD/i, cap + 1).slice(1);
  const out: ParsedContact[] = [];

  for (const card of cards) {
    if (out.length >= cap) break;
    let n = "";
    let fn = "";
    const tels: { value: string; cell: boolean }[] = [];
    let email = "";
    let title = "";
    let org = "";
    let bday = "";
    let url = "";
    const rawNotes: string[] = [];

    for (const line of card.split("\n")) {
      if (/^END:VCARD/i.test(line)) break;
      const ci = line.indexOf(":");
      if (ci < 0) continue;
      const head = line.slice(0, ci);
      let value = line.slice(ci + 1);
      const parts = head.split(";");
      const prop = parts[0].toUpperCase().replace(/^ITEM\d+\./i, ""); // iOS uses item1.TEL etc.
      const params = parts.slice(1).map((p) => p.toUpperCase());
      if (params.some((p) => p.includes("QUOTED-PRINTABLE"))) value = decodeQuotedPrintable(value);
      value = value.trim();
      if (!value || prop === "PHOTO") continue;

      if (prop === "N" && !n) n = value;
      else if (prop === "FN" && !fn) fn = value;
      else if (prop === "EMAIL" && !email) email = value;
      else if (prop === "TITLE" && !title) title = value;
      else if (prop === "ORG" && !org) org = value.split(";")[0].trim();
      else if (prop === "BDAY" && !bday) bday = value;
      else if (prop === "URL" && !url) url = value;
      else if (prop === "NOTE") rawNotes.push(value);
      else if (prop === "TEL") {
        // Keep EVERY number — nothing dropped. Mobile numbers are marked so the
        // primary can prefer a cell, but all are retained.
        tels.push({ value: cleanPhone(value), cell: params.some((p) => p.includes("CELL") || p.includes("MOBILE")) });
      }
    }

    let firstName = "";
    let lastName = "";
    if (n) {
      const nf = n.split(";"); // Family;Given;Additional;Prefix;Suffix
      lastName = (nf[0] || "").trim();
      firstName = (nf[1] || "").trim();
    }
    if (!firstName && !lastName && fn) {
      const toks = fn.trim().split(/\s+/);
      firstName = toks.shift() || "";
      lastName = toks.join(" ");
    }

    // De-duplicate numbers while preserving order; primary prefers the first cell.
    const seenTel = new Set<string>();
    const uniqTels = tels.filter((t) => t.value && !seenTel.has(t.value) && seenTel.add(t.value));
    const phones = uniqTels.map((t) => t.value);
    const primaryIdx = uniqTels.findIndex((t) => t.cell);
    const phone = primaryIdx >= 0 ? phones[primaryIdx] : phones[0] ?? "";

    // A contact with neither a name nor a number/email isn't worth importing.
    if (!firstName && !lastName && phones.length === 0 && !email) continue;
    if (!firstName && !lastName) firstName = "بدون‌نام";
    else if (!firstName) {
      firstName = lastName;
      lastName = "";
    }

    // Everything that doesn't have a dedicated CRM field goes into notes so no
    // data is lost: any additional numbers, birthday, org, website, raw notes.
    const noteParts: string[] = [];
    const extraPhones = phones.filter((p) => p !== phone);
    if (extraPhones.length) noteParts.push(`شماره‌های دیگر: ${extraPhones.join(" ، ")}`);
    if (bday) noteParts.push(`تاریخ تولد: ${bday}`);
    if (org) noteParts.push(`سازمان: ${org}`);
    if (url) noteParts.push(`وب‌سایت: ${url}`);
    for (const rn of rawNotes) noteParts.push(rn);

    out.push({
      firstName,
      lastName,
      phone,
      phones,
      email,
      title,
      company: org,
      senf: "",
      notes: noteParts.join("\n"),
    });
  }

  return out;
}

/** Split one CSV line honouring double-quoted fields (which may contain commas). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else cur += c;
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function parseCsv(text: string, cap: number): ParsedContact[] {
  const rows = text.replace(/\r\n?/g, "\n").split("\n", cap + 2).filter((l) => l.trim());
  if (rows.length < 2) return [];
  const header = splitCsvLine(rows[0]).map((h) => h.toLowerCase());
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const iFirst = find("first name", "firstname", "given name");
  const iLast = find("last name", "lastname", "family name", "surname");
  const iName = iFirst < 0 && iLast < 0 ? find("name", "نام") : -1;
  const iEmail = find("e-mail 1 - value", "email", "ایمیل");
  const iCompany = find("organization 1 - name", "company", "organization", "شرکت");
  const iTitle = find("organization 1 - title", "job title", "title", "سمت");
  const iSenf = find("senf", "صنف", "category", "دسته");
  const iNotes = find("notes", "note", "یادداشت", "توضیح");
  // EVERY column that looks like a phone number — keep them all.
  const phoneCols = header
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /(phone|mobile|tel|cell|شماره|موبایل|تلفن|همراه)/i.test(h))
    .map(({ i }) => i);

  const out: ParsedContact[] = [];
  for (let r = 1; r < rows.length && out.length < cap; r++) {
    const c = splitCsvLine(rows[r]);
    const at = (i: number) => (i >= 0 && i < c.length ? c[i].trim() : "");
    let firstName = at(iFirst);
    let lastName = at(iLast);
    if (!firstName && !lastName && iName >= 0) {
      const toks = at(iName).split(/\s+/).filter(Boolean);
      firstName = toks.shift() || "";
      lastName = toks.join(" ");
    }
    // Collect all numbers across every phone column (Google splits "Phone 1/2/3"
    // and can pack several into one cell with ::: or /).
    const rawNums: string[] = [];
    for (const pi of phoneCols) {
      for (const part of at(pi).split(/[;:/]{1,3}|\s{2,}/)) {
        const cp = cleanPhone(part);
        if (cp) rawNums.push(cp);
      }
    }
    const seen = new Set<string>();
    const phones = rawNums.filter((p) => !seen.has(p) && seen.add(p));
    const phone = phones[0] ?? "";
    const email = at(iEmail);
    if (!firstName && !lastName && phones.length === 0 && !email) continue;
    if (!firstName && !lastName) firstName = "بدون‌نام";

    const noteParts: string[] = [];
    const extraPhones = phones.slice(1);
    if (extraPhones.length) noteParts.push(`شماره‌های دیگر: ${extraPhones.join(" ، ")}`);
    const existingNote = at(iNotes);
    if (existingNote) noteParts.push(existingNote);

    out.push({
      firstName,
      lastName,
      phone,
      phones,
      email,
      title: at(iTitle),
      company: at(iCompany),
      senf: at(iSenf),
      notes: noteParts.join("\n"),
    });
  }
  return out;
}

/** Auto-detect vCard vs CSV and parse into contacts (bounded to `cap`). */
export function parseContacts(text: string, cap: number = MAX_CONTACTS): ParsedContact[] {
  return /BEGIN:VCARD/i.test(text.slice(0, 2000)) ? parseVcard(text, cap) : parseCsv(text, cap);
}
