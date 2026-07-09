// Generate a chunked SQL bulk-insert for the parsed+classified contacts, owned
// by the admin (OWNER). Mirrors importContacts dedup. No private data in git —
// output goes to the scratchpad only.
import { readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
const recs = JSON.parse(readFileSync("/home/mahrad/nexus-crm/.import-contacts.json", "utf8"));
const senf = new Map(JSON.parse(readFileSync("/home/mahrad/nexus-crm/.senf-results.json","utf8")).map(r=>[r.i,r.senf]));
const digits = s => (s||"").replace(/\D/g,"");
// within-file dedup (same rule as importContacts)
const seen = new Set();
const rows = [];
recs.forEach((r, idx) => {
  const key = digits(r.phone) || (r.email||"").toLowerCase() || `n:${idx}:${r.name}`;
  if (seen.has(key)) return; seen.add(key);
  const toks = (r.name||"").trim().split(/\s+/).filter(Boolean);
  const firstName = (toks.shift() || "بدون‌نام").slice(0,100);
  const lastName = toks.join(" ").slice(0,100);
  const phone = r.phone ? r.phone.slice(0,40) : null;
  const email = r.email ? r.email.slice(0,200) : null;
  const notes = (r.notes||"").split("\n").filter(l=>!l.startsWith("تاریخ تولد: 1970")).join("\n").slice(0,10000) || null;
  const s = senf.get(r.i) || null;
  rows.push({ firstName, lastName, phone, email, senf: s, notes });
});
const q = v => v==null ? "NULL" : `'${String(v).replace(/'/g,"''")}'`;
// chunked INSERT...SELECT FROM VALUES, admin id resolved per chunk
const CHUNK = 600;
let sql = "BEGIN;\n";
for (let i=0;i<rows.length;i+=CHUNK){
  const vals = rows.slice(i,i+CHUNK).map(r=>`(${q(r.firstName)},${q(r.lastName)},${q(r.phone)},${q(r.email)},${q(r.senf)},${q(r.notes)})`).join(",\n");
  sql += `INSERT INTO "Contact" (id,"firstName","lastName",phone,email,title,senf,notes,"companyId","ownerId","createdAt","updatedAt")\nSELECT gen_random_uuid()::text, v.fn, v.ln, v.ph, v.em, NULL, v.sf, v.nt, NULL,\n  (SELECT id FROM "User" WHERE role='OWNER' ORDER BY "createdAt" LIMIT 1), now(), now()\nFROM (VALUES\n${vals}\n) AS v(fn,ln,ph,em,sf,nt);\n`;
}
sql += "COMMIT;\nSELECT count(*) AS contacts, count(senf) AS tagged FROM \"Contact\";\n";
writeFileSync(OUT, sql);
console.log(`generated ${rows.length} contact rows → ${OUT} (${(sql.length/1e6).toFixed(2)} MB)`);
