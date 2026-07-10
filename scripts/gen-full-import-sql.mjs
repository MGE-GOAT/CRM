// Full server-side import: create companies, insert contacts (linked to company,
// with صنف + notes + all phones), all owned by the admin. Mirrors importContacts
// dedup. Output streamed into psql — never committed (private data).
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const OUT = process.argv[2];
const recs = JSON.parse(readFileSync("/home/mahrad/nexus-crm/.import-contacts.json","utf8"));
const senf = new Map(JSON.parse(readFileSync("/home/mahrad/nexus-crm/.senf-results.json","utf8")).map(r=>[r.i,r.senf]));
const comp = JSON.parse(readFileSync("/home/mahrad/nexus-crm/.company-results.json","utf8"));
const digits = s => (s||"").replace(/\D/g,"");
const q = v => v==null||v==="" ? "NULL" : `'${String(v).replace(/'/g,"''")}'`; // nullable cols
const qs = v => `'${String(v??"").replace(/'/g,"''")}'`;                         // required cols (empty -> '')

// within-file dedup (same rule as importContacts)
const seen = new Set(); const rows = [];
recs.forEach((r,idx)=>{
  const key = digits(r.phone) || (r.email||"").toLowerCase() || `n:${idx}:${r.name}`;
  if(seen.has(key)) return; seen.add(key);
  const toks=(r.name||"").trim().split(/\s+/).filter(Boolean);
  const firstName=(toks.shift()||"بدون‌نام").slice(0,100);
  const lastName=toks.join(" ").slice(0,100);
  const notes=(r.notes||"").split("\n").filter(l=>!l.startsWith("تاریخ تولد: 1970")).join("\n").slice(0,10000)||null;
  rows.push({ firstName, lastName, phone:r.phone?r.phone.slice(0,40):null, email:r.email?r.email.slice(0,200):null,
    senf:senf.get(r.i)||null, notes, company:(comp[r.i]||"").trim()||null });
});

// distinct companies → uuid
const companyId = new Map();
for(const r of rows) if(r.company && !companyId.has(r.company)) companyId.set(r.company, randomUUID());

const ADMIN = `(SELECT id FROM "User" WHERE role='OWNER' ORDER BY "createdAt" LIMIT 1)`;
let sql = "BEGIN;\n";
// companies
const comps=[...companyId.entries()];
for(let i=0;i<comps.length;i+=200){
  const vals=comps.slice(i,i+200).map(([name,id])=>`('${id}',${q(name.slice(0,200))},${ADMIN},now(),now())`).join(",\n");
  sql += `INSERT INTO "Company" (id,name,"ownerId","createdAt","updatedAt") VALUES\n${vals};\n`;
}
// contacts
const CH=600;
for(let i=0;i<rows.length;i+=CH){
  const vals=rows.slice(i,i+CH).map(r=>`(${qs(r.firstName)},${qs(r.lastName)},${q(r.phone)},${q(r.email)},${q(r.senf)},${q(r.notes)},${r.company?`'${companyId.get(r.company)}'`:"NULL"})`).join(",\n");
  sql += `INSERT INTO "Contact" (id,"firstName","lastName",phone,email,title,senf,notes,"companyId","ownerId","createdAt","updatedAt")\nSELECT gen_random_uuid()::text,v.fn,v.ln,v.ph,v.em,NULL,v.sf,v.nt,v.co,${ADMIN},now(),now()\nFROM (VALUES\n${vals}\n) AS v(fn,ln,ph,em,sf,nt,co);\n`;
}
sql += "COMMIT;\n";
// users finalize (append the prepared SQL)
sql += readFileSync(OUT.replace(/[^/]+$/,"")+"finalize-users.sql","utf8");
sql += `SELECT (SELECT count(*) FROM "Contact") AS contacts, (SELECT count(*) FROM "Company") AS companies, (SELECT count(*) FROM "Contact" WHERE senf IS NOT NULL) AS tagged;\n`;
writeFileSync(OUT, sql);
console.log(`full SQL → ${OUT}: ${rows.length} contacts, ${companyId.size} companies (${(sql.length/1e6).toFixed(2)} MB)`);
