"use client";

import { useState, useTransition } from "react";
import { Hash, Check } from "lucide-react";
import { setNextFactorNumber } from "@/lib/actions/factors";
import { toFa, toEn } from "@/lib/format";

/**
 * OWNER-only: view and change the running factor-number counter so the next
 * factor's code continues from a chosen value (e.g. their real ~5000 sequence).
 */
export function FactorNumberSetting({ current }: { current: number }) {
  const [value, setValue] = useState(String(current));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const n = Number(toEn(value).replace(/\D/g, ""));
    if (!n || n < 1) {
      setError("شمارهٔ نامعتبر است.");
      return;
    }
    setError(null);
    setMsg(null);
    start(async () => {
      const res = await setNextFactorNumber(n);
      if (res && res.error) setError(res.error);
      else setMsg(`شمارهٔ فاکتور بعدی روی ${toFa(n)} تنظیم شد.`);
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
      <div className="mb-2 flex items-center gap-2">
        <Hash size={15} className="text-[color:var(--gold-ink)]" aria-hidden="true" />
        <h3 className="text-sm font-bold tracking-tight">شمارهٔ فاکتور</h3>
        <span className="rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
          فقط مالک
        </span>
      </div>
      <p className="mb-3 text-xs text-muted">
        شمارهٔ فاکتور بعدی. با تغییر آن، شماره‌گذاری از عدد جدید ادامه می‌یابد (پیوسته، بدون
        بازنشانی ماهانه).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          dir="ltr"
          className="w-40 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm tabular-nums outline-none focus:border-[var(--gold-mid)]"
        />
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--gold-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          <Check size={15} aria-hidden="true" /> {pending ? "در حال ذخیره…" : "ذخیره"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-emerald-600">{msg}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
