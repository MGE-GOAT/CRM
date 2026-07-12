import { VAZIR_400, VAZIR_700 } from "@/lib/fonts/vazirmatn";
import { numberToPersianWords } from "@/lib/num-to-fa";

// The subset of archived-factor fields the invoice needs. Matches the shape of
// `allFactors[i]` produced by buildMonthArchive().
export type InvoiceFactor = {
  number: number;
  stateLabel: string;
  paymentKindLabel: string;
  buyerName: string;
  buyerPhone?: string | null;
  buyerAddress?: string | null;
  buyerEconomicCode?: string | null;
  buyerNationalId?: string | null;
  buyerRegistrationNumber?: string | null;
  buyerPostalCode?: string | null;
  sellerName?: string | null;
  sellerAddress?: string | null;
  sellerPhone?: string | null;
  sellerMobile?: string | null;
  sellerInstagram?: string | null;
  sellerWebsite?: string | null;
  discount: number;
  vat: number;
  payableRial: number;
  notes?: string | null;
  createdAt: string;
  items: { row: number; name: string; quantity: number; unitPrice: number; description?: string | null }[];
};

const fa = (n: number) => new Intl.NumberFormat("fa-IR").format(Math.round(n));
const faDate = (iso: string) =>
  new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** A self-contained, print-ready A4 invoice HTML for one factor (embedded font). */
export function factorInvoiceHtml(f: InvoiceFactor): string {
  const subtotal = f.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const idRows = [
    ["شناسه/کد ملی", f.buyerNationalId],
    ["شماره اقتصادی", f.buyerEconomicCode],
    ["کد پستی", f.buyerPostalCode],
    ["شماره ثبت", f.buyerRegistrationNumber],
  ].filter(([, v]) => v);

  const itemsHtml = f.items
    .map(
      (it) => `<tr>
      <td class="c">${fa(it.row)}</td>
      <td>${esc(it.name)}${it.description ? `<div class="desc">${esc(it.description)}</div>` : ""}</td>
      <td class="c">${fa(it.quantity)}</td>
      <td class="n">${fa(it.unitPrice)}</td>
      <td class="n">${fa(it.quantity * it.unitPrice)}</td>
    </tr>`,
    )
    .join("");

  return `<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8">
<style>
@font-face{font-family:'Vazirmatn';font-weight:400;src:url('${VAZIR_400}') format('woff2');}
@font-face{font-family:'Vazirmatn';font-weight:700;src:url('${VAZIR_700}') format('woff2');}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{font-family:'Vazirmatn',sans-serif;color:#1a1a1a;font-size:12px;line-height:1.7;}
.page{padding:28px 30px;}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #b8860b;padding-bottom:12px;margin-bottom:16px;}
.brand{font-size:20px;font-weight:700;color:#8a6d1a;}
.sub{color:#666;font-size:11px;}
.docmeta{text-align:left;font-size:11px;color:#444;}
.tag{display:inline-block;background:#faf3df;color:#8a6d1a;border-radius:6px;padding:1px 8px;font-weight:700;font-size:10px;}
.grid{display:flex;gap:12px;margin-bottom:14px;}
.box{flex:1;border:1px solid #e5e0d5;border-radius:10px;padding:10px 12px;background:#fbfaf6;}
.box h3{font-size:10px;color:#8a6d1a;background:#faf3df;display:inline-block;padding:1px 6px;border-radius:5px;margin-bottom:6px;}
.box .name{font-weight:700;}
.box .row{color:#555;}
dl.ids{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin-top:6px;border-top:1px solid #eee;padding-top:6px;font-size:10px;color:#555;}
dl.ids .k{color:#999;}
table{width:100%;border-collapse:collapse;margin-bottom:12px;}
th{background:#f3efe4;color:#555;font-size:10px;text-align:right;padding:7px 8px;border-bottom:2px solid #d9cfae;}
td{padding:7px 8px;border-bottom:1px solid #eee;vertical-align:top;}
td.c,th.c{text-align:center;}
td.n,th.n{text-align:left;font-variant-numeric:tabular-nums;}
.desc{color:#888;font-size:10px;margin-top:2px;}
.totals{width:52%;margin-inline-start:auto;font-size:12px;}
.totals .l{display:flex;justify-content:space-between;padding:3px 0;color:#555;}
.totals .pay{display:flex;justify-content:space-between;font-weight:700;font-size:14px;border-top:1px solid #d9cfae;padding-top:6px;margin-top:4px;}
.words{background:#faf3df;border-radius:8px;padding:8px 10px;font-size:11px;color:#6a5410;margin-top:10px;}
.foot{display:flex;justify-content:space-between;color:#888;font-size:10px;margin-top:26px;border-top:1px dashed #ddd;padding-top:20px;}
.note{color:#777;font-size:10px;margin-top:8px;}
</style></head>
<body><div class="page">
  <div class="head">
    <div>
      <div class="brand">${esc(f.sellerName || "اسپان هلدینگ")}</div>
      <div class="sub">صورتحساب فروش کالا / خدمات</div>
    </div>
    <div class="docmeta">
      <div><span class="tag">${esc(f.stateLabel)}</span></div>
      <div style="margin-top:4px">شماره: ${fa(f.number)}</div>
      <div>تاریخ: ${faDate(f.createdAt)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>مشخصات خریدار</h3>
      <div class="name">${esc(f.buyerName)}</div>
      ${f.buyerPhone ? `<div class="row" dir="ltr" style="text-align:right">${esc(f.buyerPhone)}</div>` : ""}
      ${f.buyerAddress ? `<div class="row">${esc(f.buyerAddress)}</div>` : ""}
      ${idRows.length ? `<dl class="ids">${idRows.map(([k, v]) => `<div><span class="k">${k}:</span> ${esc(v)}</div>`).join("")}</dl>` : ""}
    </div>
    <div class="box">
      <h3>مشخصات فروشنده</h3>
      <div class="name">${esc(f.sellerName || "اسپان هلدینگ")}</div>
      ${f.sellerAddress ? `<div class="row">${esc(f.sellerAddress)}</div>` : ""}
      ${f.sellerPhone ? `<div class="row" dir="ltr" style="text-align:right">${esc(f.sellerPhone)}${f.sellerMobile ? " · " + esc(f.sellerMobile) : ""}</div>` : ""}
      ${f.sellerWebsite ? `<div class="row" dir="ltr" style="text-align:right">${esc(f.sellerWebsite)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th class="c">ردیف</th><th>نام کالا / خدمات</th><th class="c">تعداد</th><th class="n">بهای واحد (ریال)</th><th class="n">مبلغ کل (ریال)</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="totals">
    <div class="l"><span>جمع کل</span><span>${fa(subtotal)} ریال</span></div>
    ${f.discount ? `<div class="l"><span>تخفیف</span><span>${fa(f.discount)} ریال</span></div>` : ""}
    ${f.vat ? `<div class="l"><span>مالیات</span><span>${fa(f.vat)} ریال</span></div>` : ""}
    <div class="pay"><span>مبلغ قابل پرداخت</span><span>${fa(f.payableRial)} ریال</span></div>
  </div>
  <div class="words">${numberToPersianWords(f.payableRial)}</div>
  <div class="note">نوع پرداخت: ${esc(f.paymentKindLabel)}</div>
  ${f.notes ? `<div class="note">${esc(f.notes)}</div>` : ""}

  <div class="foot"><span>مهر و امضای فروشنده</span><span>مهر و امضای خریدار</span></div>
</div></body></html>`;
}
