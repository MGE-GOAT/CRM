"use client";

import { useState, useTransition } from "react";
import { Archive, Download, FileArchive, Lock } from "lucide-react";
import { closeMonthAction } from "@/lib/actions/month-close";

export type ArchiveRow = {
  month: string;
  label: string;
  factorCount: number;
  attendanceCount: number;
  createdAt: string;
};

export type ClosableMonth = { month: string; label: string };

/**
 * OWNER-only: manually close a completed month (back up → purge its live rows)
 * and browse/download previously archived months. Closing is destructive but
 * the full snapshot is persisted first and stays downloadable.
 */
export function MonthArchiveSection({
  archives,
  closable,
}: {
  archives: ArchiveRow[];
  closable: ClosableMonth[];
}) {
  const [selected, setSelected] = useState(closable[0]?.month ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClose = () => {
    const m = closable.find((c) => c.month === selected);
    if (!m) return;
    if (
      !confirm(
        `«${m.label}» بسته شود؟ ابتدا یک بکاپ کامل از تمام فاکتورهای آن ماه ذخیره می‌شود، سپس فقط فاکتورهای تمام‌شده (خروج و لغو‌شده) و رکوردهای حضورِ آن ماه از فهرست‌های جاری پاک می‌شوند. پیش‌فاکتورهای در جریان دست‌نخورده می‌مانند و بکاپ همیشه قابل دریافت خواهد بود.`,
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await closeMonthAction(m.month);
      if (res && res.error) setError(res.error);
    });
  };

  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold tracking-tight text-text">
          <Archive size={15} aria-hidden="true" /> بایگانی ماهانه
        </h2>
        <span className="rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
          فقط مالک
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-sm)]">
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Close a completed month */}
        {closable.length > 0 ? (
          <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">بستن و آرشیو ماه</span>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
              >
                {closable.map((c) => (
                  <option key={c.month} value={c.month}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !selected}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--gold-ink)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <Lock size={15} aria-hidden="true" />
              {pending ? "در حال بستن…" : "بکاپ و بستن ماه"}
            </button>
            <p className="w-full text-xs text-muted">
              با بستن یک ماه، ابتدا بکاپ کامل ذخیره می‌شود و سپس فقط فاکتورهای تمام‌شده (خروج و
              لغو‌شده) و حضورِ آن ماه از فهرست‌های جاری پاک می‌شوند؛ پیش‌فاکتورهای در جریان می‌مانند.
              داده‌ها هیچ‌گاه از دست نمی‌روند.
            </p>
          </div>
        ) : (
          <p className="border-b border-border pb-4 text-sm text-muted">
            ماه گذشته‌ای برای بستن وجود ندارد.
          </p>
        )}

        {/* Archived months */}
        <div className="pt-4">
          <h3 className="mb-2 text-sm font-medium">ماه‌های آرشیوشده</h3>
          {archives.length === 0 ? (
            <p className="text-sm text-muted">هنوز ماهی آرشیو نشده است.</p>
          ) : (
            <ul className="divide-y divide-border">
              {archives.map((a) => (
                <li
                  key={a.month}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="flex items-center gap-3 text-muted">
                    <span className="tabular-nums">{toFaNum(a.factorCount)} فاکتور</span>
                    <span className="tabular-nums">{toFaNum(a.attendanceCount)} رکورد حضور</span>
                    <a
                      href={`/api/reports/backup?month=${a.month}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
                    >
                      <Download size={13} aria-hidden="true" /> داده‌ای
                    </a>
                    <a
                      href={`/api/reports/backup/pdf?month=${a.month}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
                    >
                      <FileArchive size={13} aria-hidden="true" /> PDF فاکتورها
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function toFaNum(n: number): string {
  return new Intl.NumberFormat("fa-IR").format(n);
}
