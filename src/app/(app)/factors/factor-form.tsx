"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea, SubmitButton, ModalForm } from "@/components/ui/form";
import { PAYMENT_KIND_LABEL } from "@/lib/factor";
import { formatNumber, parseAmount } from "@/lib/format";
import { numberToPersianWords } from "@/lib/num-to-fa";
import type { PaymentKind } from "@prisma/client";

export type ContactOption = {
  id: string;
  name: string;
  phone: string;
  address: string;
  economicCode?: string;
  nationalId?: string;
  registrationNumber?: string;
  postalCode?: string;
};

export type LineItemInput = {
  name: string;
  quantity: string;
  unitPrice: string;
  description: string;
};

export type FactorInitial = {
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  buyerEconomicCode?: string;
  buyerNationalId?: string;
  buyerRegistrationNumber?: string;
  buyerPostalCode?: string;
  contactId?: string;
  paymentKind: PaymentKind | ""; // "" = not yet chosen (required on submit)
  discount: string;
  vat: string;
  notes: string;
  sellerName: string;
  sellerAddress: string;
  sellerPhone: string;
  sellerMobile: string;
  sellerInstagram: string;
  sellerWebsite: string;
  items: LineItemInput[];
};

const DEFAULT_NOTES = "اعتبار پیش فاکتور درصورت واریز نقدی حداکثر ۴۸ ساعت می‌باشد";

export const SELLER_DEFAULTS = {
  sellerName: "اسپان هلدینگ",
  sellerAddress: "تهران، ۵ خرداد",
  sellerPhone: "۰۹۱۲۲۶۰۰۸۰۴",
  sellerMobile: "۰۹۱۲۴۴۸۴۷۴۴",
  sellerInstagram: "@spunholding",
  sellerWebsite: "www.spunholding.com",
};

function emptyInitial(): FactorInitial {
  return {
    buyerName: "",
    buyerPhone: "",
    buyerAddress: "",
    paymentKind: "",
    discount: "0",
    vat: "0",
    notes: DEFAULT_NOTES,
    ...SELLER_DEFAULTS,
    items: [{ name: "", quantity: "1", unitPrice: "0", description: "" }],
  };
}

const PAYMENT_KINDS: PaymentKind[] = ["CASH", "CHEQUE", "HALF_HALF"];

export function FactorForm({
  action,
  contacts = [],
  initial,
  triggerLabel = "فاکتور جدید",
  title = "پیش‌فاکتور جدید",
  triggerClassName = "btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm",
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  contacts?: ContactOption[];
  initial?: FactorInitial;
  triggerLabel?: string;
  title?: string;
  triggerClassName?: string;
}) {
  return (
    <Modal
      wide
      title={title}
      trigger={(open) => (
        <button onClick={open} className={triggerClassName}>
          <Plus size={16} aria-hidden="true" /> {triggerLabel}
        </button>
      )}
    >
      {(close) => (
        <FactorFormBody
          action={action}
          contacts={contacts}
          initial={initial ?? emptyInitial()}
          onDone={close}
        />
      )}
    </Modal>
  );
}

function FactorFormBody({
  action,
  contacts,
  initial,
  onDone,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  contacts: ContactOption[];
  initial: FactorInitial;
  onDone: () => void;
}) {
  const [buyerName, setBuyerName] = useState(initial.buyerName);
  const [buyerPhone, setBuyerPhone] = useState(initial.buyerPhone);
  const [buyerAddress, setBuyerAddress] = useState(initial.buyerAddress);
  const [economicCode, setEconomicCode] = useState(initial.buyerEconomicCode ?? "");
  const [nationalId, setNationalId] = useState(initial.buyerNationalId ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(
    initial.buyerRegistrationNumber ?? "",
  );
  const [postalCode, setPostalCode] = useState(initial.buyerPostalCode ?? "");
  const [showBuyerIds, setShowBuyerIds] = useState(
    Boolean(
      initial.buyerEconomicCode ||
        initial.buyerNationalId ||
        initial.buyerRegistrationNumber ||
        initial.buyerPostalCode,
    ),
  );
  const [contactId, setContactId] = useState(initial.contactId ?? "");
  const [items, setItems] = useState<LineItemInput[]>(initial.items);
  const [discount, setDiscount] = useState(initial.discount);
  const [vat, setVat] = useState(initial.vat);
  const [showSeller, setShowSeller] = useState(false);

  const subtotal = items.reduce(
    (sum, it) => sum + parseAmount(it.quantity) * parseAmount(it.unitPrice),
    0,
  );
  const payable = Math.max(0, subtotal - parseAmount(discount) + parseAmount(vat));

  const updateItem = (idx: number, patch: Partial<LineItemInput>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () =>
    setItems((prev) => [...prev, { name: "", quantity: "1", unitPrice: "0", description: "" }]);
  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const onPickContact = (id: string) => {
    setContactId(id);
    const c = contacts.find((x) => x.id === id);
    if (c) {
      setBuyerName(c.name);
      setBuyerPhone(c.phone);
      setBuyerAddress(c.address);
      setEconomicCode(c.economicCode ?? "");
      setNationalId(c.nationalId ?? "");
      setRegistrationNumber(c.registrationNumber ?? "");
      setPostalCode(c.postalCode ?? "");
      if (c.economicCode || c.nationalId || c.registrationNumber || c.postalCode) {
        setShowBuyerIds(true);
      }
    }
  };

  // Serialize items to the numeric shape the server action parses.
  const itemsJson = JSON.stringify(
    items.map((it) => ({
      name: it.name,
      quantity: parseAmount(it.quantity),
      unitPrice: parseAmount(it.unitPrice),
      description: it.description || undefined,
    })),
  );

  return (
    <ModalForm action={action} onDone={onDone}>
      <input type="hidden" name="items" value={itemsJson} />
      <input type="hidden" name="contactId" value={contactId} />

      {contacts.length > 0 && (
        <Field label="انتخاب از مخاطبین (اختیاری)">
          <Select value={contactId} onChange={(e) => onPickContact(e.target.value)}>
            <option value="">— بدون مخاطب —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="نام خریدار">
          <Input
            name="buyerName"
            required
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
          />
        </Field>
        <Field label="تلفن خریدار">
          <Input
            name="buyerPhone"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
          />
        </Field>
      </div>
      <Field label="آدرس خریدار">
        <Textarea
          name="buyerAddress"
          rows={2}
          value={buyerAddress}
          onChange={(e) => setBuyerAddress(e.target.value)}
        />
      </Field>

      {/* Buyer invoice-identity fields (optional; auto-filled from the contact) */}
      <div>
        <button
          type="button"
          onClick={() => setShowBuyerIds((s) => !s)}
          className="text-xs text-muted underline"
        >
          {showBuyerIds ? "بستن مشخصات تکمیلی خریدار" : "افزودن مشخصات تکمیلی خریدار (کد ملی، کد اقتصادی…)"}
        </button>
        {showBuyerIds && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="شناسه/شماره ملی">
              <Input
                name="buyerNationalId"
                dir="ltr"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
              />
            </Field>
            <Field label="شماره اقتصادی">
              <Input
                name="buyerEconomicCode"
                dir="ltr"
                value={economicCode}
                onChange={(e) => setEconomicCode(e.target.value)}
              />
            </Field>
            <Field label="کد پستی">
              <Input
                name="buyerPostalCode"
                dir="ltr"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </Field>
            <Field label="شماره ثبت">
              <Input
                name="buyerRegistrationNumber"
                dir="ltr"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <Field label="نوع پرداخت">
        <Select name="paymentKind" defaultValue={initial.paymentKind} required>
          <option value="" disabled>
            — انتخاب نوع پرداخت —
          </option>
          {PAYMENT_KINDS.map((k) => (
            <option key={k} value={k}>
              {PAYMENT_KIND_LABEL[k]}
            </option>
          ))}
        </Select>
      </Field>

      {/* Line items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">اقلام فاکتور</span>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-[var(--gold-tint)]"
          >
            <Plus size={14} aria-hidden="true" /> افزودن ردیف
          </button>
        </div>
        <div className="space-y-3">
          {/* Persistent column labels (placeholders vanish once a row is filled) */}
          <div className="hidden grid-cols-12 gap-2 px-3 text-xs font-medium text-faint sm:grid">
            <div className="col-span-5">نام کالا/خدمات</div>
            <div className="col-span-2">تعداد</div>
            <div className="col-span-4">بهای واحد (ریال)</div>
            <div className="col-span-1" />
          </div>
          {items.map((it, idx) => {
            const lineTotal = parseAmount(it.quantity) * parseAmount(it.unitPrice);
            return (
              <div key={idx} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <Input
                      placeholder="نام کالا/خدمات"
                      value={it.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      placeholder="تعداد"
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      placeholder="بهای واحد (ریال)"
                      inputMode="numeric"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center justify-center sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"
                      aria-label="حذف ردیف"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="sm:col-span-11">
                    <Input
                      placeholder="شرح (اختیاری)"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-2 text-end text-xs text-muted">
                  مبلغ کل: {formatNumber(lineTotal)} ریال
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="تخفیف (ریال)">
          <Input
            name="discount"
            inputMode="numeric"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        <Field label="مالیات (ریال)">
          <Input
            name="vat"
            inputMode="numeric"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          />
        </Field>
      </div>

      {/* Live totals */}
      <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">جمع کل</span>
          <span className="tabular-nums">{formatNumber(subtotal)} ریال</span>
        </div>
        <div className="mt-1 flex items-center justify-between font-bold">
          <span>مبلغ قابل پرداخت</span>
          <span className="tabular-nums">{formatNumber(payable)} ریال</span>
        </div>
        <div className="mt-1 text-xs text-muted">{numberToPersianWords(payable)}</div>
      </div>

      <Field label="توضیحات">
        <Textarea name="notes" rows={2} defaultValue={initial.notes} />
      </Field>

      {/* Seller (collapsed, prefilled) */}
      <div>
        <button
          type="button"
          onClick={() => setShowSeller((s) => !s)}
          className="text-xs text-muted underline"
        >
          {showSeller ? "بستن مشخصات فروشنده" : "ویرایش مشخصات فروشنده"}
        </button>
        {showSeller && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="نام فروشنده">
              <Input name="sellerName" defaultValue={initial.sellerName} />
            </Field>
            <Field label="آدرس فروشنده">
              <Input name="sellerAddress" defaultValue={initial.sellerAddress} />
            </Field>
            <Field label="تلفن">
              <Input name="sellerPhone" defaultValue={initial.sellerPhone} />
            </Field>
            <Field label="همراه">
              <Input name="sellerMobile" defaultValue={initial.sellerMobile} />
            </Field>
            <Field label="اینستاگرام">
              <Input name="sellerInstagram" defaultValue={initial.sellerInstagram} />
            </Field>
            <Field label="وب‌سایت">
              <Input name="sellerWebsite" defaultValue={initial.sellerWebsite} />
            </Field>
          </div>
        )}
      </div>

      <p className="text-xs text-faint">
        همهٔ مبالغ به ریال است. شمارهٔ فاکتور به‌صورت خودکار در ماه جاری صادر می‌شود.
      </p>

      <div className="flex justify-end pt-2">
        <SubmitButton>ثبت</SubmitButton>
      </div>
    </ModalForm>
  );
}
