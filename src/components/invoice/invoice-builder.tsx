"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Printer } from "lucide-react";
import { formatRial, formatNumber, toFa } from "@/lib/format";
import { toPersianWords } from "@/lib/num-to-words";

type Party = { name: string; phone?: string | null; address?: string | null };
type Seller = { name: string; economicCode: string; phone: string; address: string };
type Item = { id: number; desc: string; qty: number; unit: string; price: number };

const SELLER_STORAGE_KEY = "nexus-invoice-seller";
const inputBase =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20";

export function InvoiceBuilder({
  sellerName,
  buyer,
  defaultItem,
  defaultDate,
  defaultInvoiceNo,
}: {
  sellerName: string;
  buyer: Party;
  defaultItem: { desc: string; price: number };
  defaultDate: string;
  defaultInvoiceNo: string;
}) {
  const [open, setOpen] = useState(false);
  const [seller, setSeller] = useState<Seller>({
    name: sellerName,
    economicCode: "",
    phone: "",
    address: "",
  });
  const [buyerName, setBuyerName] = useState(buyer.name);
  const [buyerEco, setBuyerEco] = useState("");
  const [buyerPhone, setBuyerPhone] = useState(buyer.phone ?? "");
  const [buyerAddr, setBuyerAddr] = useState(buyer.address ?? "");
  const [invoiceNo, setInvoiceNo] = useState(defaultInvoiceNo);
  const [date, setDate] = useState(defaultDate);
  const [items, setItems] = useState<Item[]>([
    { id: 1, desc: defaultItem.desc, qty: 1, unit: "عدد", price: defaultItem.price },
  ]);
  const [nextId, setNextId] = useState(2);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  // Remember the seller's details across invoices on this browser (no DB needed).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SELLER_STORAGE_KEY);
      if (saved) setSeller((s) => ({ ...s, ...JSON.parse(saved) }));
    } catch {
      /* ignore malformed storage */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SELLER_STORAGE_KEY, JSON.stringify(seller));
    } catch {
      /* storage may be unavailable */
    }
  }, [seller]);

  const { subtotal, taxAmount, total } = useMemo(() => {
    const sub = Math.round(items.reduce((s, it) => s + it.qty * it.price, 0));
    const taxable = Math.max(0, sub - discount);
    const tax = Math.round((taxable * taxRate) / 100);
    // Round to whole Toman so the displayed number and the amount-in-words agree.
    return { subtotal: sub, taxAmount: tax, total: Math.round(taxable + tax) };
  }, [items, discount, taxRate]);

  function addItem() {
    setItems((prev) => [...prev, { id: nextId, desc: "", qty: 1, unit: "عدد", price: 0 }]);
    setNextId((n) => n + 1);
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }
  function patch(id: number, field: keyof Item, value: string | number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  if (!open) {
    return (
      <div className="panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold tracking-tight">فاکتور فروش</h2>
            <p className="mt-0.5 text-sm text-muted">صدور فاکتور برای این معامله و دریافت خروجی PDF.</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-gold shrink-0 rounded-lg px-4 py-2 text-sm"
          >
            صدور فاکتور فروش
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-5">
      {/* ---- Editable form (hidden on print) ---- */}
      <div className="no-print space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold tracking-tight">ویرایش فاکتور فروش</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted hover:bg-[var(--gold-tint)] hover:text-text"
          >
            بستن
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            شماره فاکتور
            <input dir="ltr" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} className={`mt-1 ${inputBase}`} />
          </label>
          <label className="text-sm">
            تاریخ
            <input value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1 ${inputBase}`} />
          </label>
        </div>

        <fieldset className="grid gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-medium text-muted">فروشنده</legend>
          <input placeholder="نام فروشنده" value={seller.name} onChange={(e) => setSeller({ ...seller, name: e.target.value })} className={inputBase} />
          <input placeholder="کد اقتصادی" dir="ltr" value={seller.economicCode} onChange={(e) => setSeller({ ...seller, economicCode: e.target.value })} className={inputBase} />
          <input placeholder="تلفن" dir="ltr" value={seller.phone} onChange={(e) => setSeller({ ...seller, phone: e.target.value })} className={inputBase} />
          <input placeholder="نشانی" value={seller.address} onChange={(e) => setSeller({ ...seller, address: e.target.value })} className={inputBase} />
        </fieldset>

        <fieldset className="grid gap-3 rounded-xl border border-border bg-surface-2 p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-medium text-muted">خریدار</legend>
          <input placeholder="نام شخص / شرکت" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={inputBase} />
          <input placeholder="کد اقتصادی" dir="ltr" value={buyerEco} onChange={(e) => setBuyerEco(e.target.value)} className={inputBase} />
          <input placeholder="تلفن" dir="ltr" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className={inputBase} />
          <input placeholder="نشانی" value={buyerAddr} onChange={(e) => setBuyerAddr(e.target.value)} className={inputBase} />
        </fieldset>

        {/* line items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">اقلام</span>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-[var(--gold-tint)]">
              <Plus size={14} /> افزودن ردیف
            </button>
          </div>
          {items.map((it, idx) => (
            <div key={it.id} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-12">
              <input placeholder="شرح کالا / خدمات" value={it.desc} onChange={(e) => patch(it.id, "desc", e.target.value)} className={`col-span-2 sm:col-span-5 ${inputBase}`} />
              <input aria-label="تعداد" type="number" min={0} dir="ltr" value={it.qty} onChange={(e) => patch(it.id, "qty", Number(e.target.value) || 0)} className={`col-span-1 sm:col-span-1 ${inputBase}`} />
              <input aria-label="واحد" value={it.unit} onChange={(e) => patch(it.id, "unit", e.target.value)} className={`col-span-1 sm:col-span-2 ${inputBase}`} />
              <input aria-label="قیمت واحد (ریال)" type="number" min={0} dir="ltr" value={it.price} onChange={(e) => patch(it.id, "price", Number(e.target.value) || 0)} className={`col-span-2 sm:col-span-3 ${inputBase}`} />
              <button type="button" onClick={() => removeItem(it.id)} disabled={items.length <= 1} aria-label={`حذف ردیف ${idx + 1}`} className="col-span-2 flex items-center justify-center rounded-lg border border-border p-2 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:col-span-1">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            تخفیف (ریال)
            <input type="number" min={0} dir="ltr" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className={`mt-1 ${inputBase}`} />
          </label>
          <label className="text-sm">
            مالیات بر ارزش افزوده (٪)
            <input type="number" min={0} max={100} dir="ltr" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) || 0)} className={`mt-1 ${inputBase}`} />
          </label>
        </div>

        <button type="button" onClick={() => window.print()} className="btn-gold inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm">
          <Printer size={16} /> چاپ / دانلود PDF
        </button>
      </div>

      {/* ---- Printable / preview invoice ---- */}
      <div className="print-invoice mt-6 rounded-lg border border-border bg-surface p-6 text-black">
        <div className="flex items-start justify-between border-b-2 border-border pb-4">
          <h1 className="text-2xl font-extrabold">فاکتور فروش</h1>
          <div className="text-left text-sm">
            <div>شماره: <span dir="ltr">{toFa(invoiceNo || "—")}</span></div>
            <div>تاریخ: {date || "—"}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold">فروشنده</div>
            <div>{seller.name}</div>
            {seller.economicCode && <div>کد اقتصادی: <span dir="ltr">{toFa(seller.economicCode)}</span></div>}
            {seller.phone && <div>تلفن: <span dir="ltr">{toFa(seller.phone)}</span></div>}
            {seller.address && <div>نشانی: {seller.address}</div>}
          </div>
          <div>
            <div className="font-semibold">خریدار</div>
            <div>{buyerName || "—"}</div>
            {buyerEco && <div>کد اقتصادی: <span dir="ltr">{toFa(buyerEco)}</span></div>}
            {buyerPhone && <div>تلفن: <span dir="ltr">{toFa(buyerPhone)}</span></div>}
            {buyerAddr && <div>نشانی: {buyerAddr}</div>}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-3 text-right">
              <th className="border border-border-strong p-2 font-semibold">ردیف</th>
              <th className="border border-border-strong p-2 font-semibold">شرح کالا / خدمات</th>
              <th className="border border-border-strong p-2 font-semibold">تعداد</th>
              <th className="border border-border-strong p-2 font-semibold">واحد</th>
              <th className="border border-border-strong p-2 font-semibold">قیمت واحد (ریال)</th>
              <th className="border border-border-strong p-2 font-semibold">مبلغ (ریال)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id}>
                <td className="border border-border-strong p-2 text-center">{toFa(i + 1)}</td>
                <td className="border border-border-strong p-2">{it.desc || "—"}</td>
                <td className="border border-border-strong p-2 text-center">{toFa(it.qty)}</td>
                <td className="border border-border-strong p-2 text-center">{it.unit}</td>
                <td className="border border-border-strong p-2 text-left tabular-nums">{formatNumber(it.price)}</td>
                <td className="border border-border-strong p-2 text-left tabular-nums">{formatNumber(it.qty * it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="mt-4 flex justify-end">
          <table className="text-sm">
            <tbody>
              <tr><td className="py-1 pl-6 text-muted">جمع کل:</td><td className="py-1 text-left tabular-nums">{formatRial(subtotal)}</td></tr>
              {discount > 0 && <tr><td className="py-1 pl-6 text-muted">تخفیف:</td><td className="py-1 text-left tabular-nums">{formatRial(discount)}</td></tr>}
              {taxRate > 0 && <tr><td className="py-1 pl-6 text-muted">مالیات بر ارزش افزوده ({toFa(taxRate)}٪):</td><td className="py-1 text-left tabular-nums">{formatRial(taxAmount)}</td></tr>}
              <tr className="border-t border-border-strong font-bold"><td className="py-1.5 pl-6">مبلغ قابل پرداخت:</td><td className="py-1.5 text-left tabular-nums">{formatRial(total)}</td></tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm">مبلغ به حروف: {toPersianWords(total)} ریال</p>

        <div className="mt-10 grid grid-cols-2 gap-4 text-center text-sm text-muted">
          <div>مهر و امضای فروشنده</div>
          <div>مهر و امضای خریدار</div>
        </div>
      </div>
    </div>
  );
}
