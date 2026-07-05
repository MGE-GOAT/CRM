// Parse contacts from an iPhone/iCloud vCard (.vcf) export or a CSV file into a
// flat shape the CRM can bulk-insert. Handles the real-world messiness of iOS
// exports: vCard 2.1 + 3.0, line folding, and QUOTED-PRINTABLE encoding (which
// iPhones commonly use for Persian/non-ASCII names).

export type ParsedContact = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  title: string;
  company: string;
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
    let tel = "";
    let telIsCell = false;
    let email = "";
    let title = "";
    let org = "";

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
      else if (prop === "TEL") {
        const isCell = params.some((p) => p.includes("CELL") || p.includes("MOBILE"));
        // Prefer the first mobile number; otherwise keep the first number seen.
        if (!tel || (isCell && !telIsCell)) {
          tel = value;
          telIsCell = isCell;
        }
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
    // A contact with neither a name nor a phone/email isn't worth importing.
    if (!firstName && !lastName && !tel && !email) continue;
    if (!firstName && !lastName) firstName = "بدون‌نام";
    else if (!firstName) {
      firstName = lastName;
      lastName = "";
    }

    out.push({ firstName, lastName, phone: cleanPhone(tel), email, title, company: org });
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
  const iPhone = find("phone 1 - value", "mobile", "phone", "tel", "cell", "شماره", "موبایل", "تلفن");
  const iEmail = find("e-mail 1 - value", "email", "ایمیل");
  const iCompany = find("organization 1 - name", "company", "organization", "شرکت");
  const iTitle = find("organization 1 - title", "job title", "title", "سمت");

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
    const phone = cleanPhone(at(iPhone));
    const email = at(iEmail);
    if (!firstName && !lastName && !phone && !email) continue;
    if (!firstName && !lastName) firstName = "بدون‌نام";
    out.push({ firstName, lastName, phone, email, title: at(iTitle), company: at(iCompany) });
  }
  return out;
}

/** Auto-detect vCard vs CSV and parse into contacts (bounded to `cap`). */
export function parseContacts(text: string, cap: number = MAX_CONTACTS): ParsedContact[] {
  return /BEGIN:VCARD/i.test(text.slice(0, 2000)) ? parseVcard(text, cap) : parseCsv(text, cap);
}
