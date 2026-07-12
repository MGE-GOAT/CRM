"use client";

import { useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatNumber } from "@/lib/format";

/**
 * Floating selection bar shown when one or more rows are selected. Rendered only
 * for OWNER users by the list wrappers. `noun` is the Persian singular of the
 * item being deleted (e.g. «مخاطب»، «شرکت») used in the confirm prompt.
 */
export function BulkActionBar({
  count,
  allSelected,
  onToggleAll,
  onClear,
  onDelete,
  noun,
}: {
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  onDelete: () => Promise<{ error?: string } | void>;
  noun: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="panel pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl border border-border-strong bg-surface px-4 py-2.5 shadow-[var(--shadow-lg)]">
        <button
          onClick={onClear}
          className="rounded-lg p-1 text-muted hover:bg-[var(--gold-tint)] hover:text-text"
          aria-label="لغو انتخاب"
          title="لغو انتخاب"
        >
          <X size={16} aria-hidden="true" />
        </button>
        <span className="text-sm font-medium">
          {formatNumber(count)} مورد انتخاب شده
        </span>
        <button
          onClick={onToggleAll}
          className="rounded-lg px-2 py-1 text-sm text-[var(--gold-ink)] hover:bg-[var(--gold-tint)]"
        >
          {allSelected ? "لغو انتخاب همه" : "انتخاب همه"}
        </button>

        {error && <span className="text-xs text-red-600">{error}</span>}

        <Modal
          title="تأیید حذف گروهی"
          trigger={(open) => (
            <button
              onClick={() => {
                setError(null);
                open();
              }}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 size={16} aria-hidden="true" />
              حذف
            </button>
          )}
        >
          {(close) => (
            <div>
              <p className="text-sm text-text">
                حذف {formatNumber(count)} {noun}؟ این عمل قابل بازگشت نیست.
              </p>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={close}
                  disabled={pending}
                  className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-[var(--gold-tint)] disabled:opacity-50"
                >
                  انصراف
                </button>
                <button
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const res = await onDelete();
                      if (res?.error) {
                        setError(res.error);
                        return;
                      }
                      close();
                    })
                  }
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {pending ? "در حال حذف…" : "حذف"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
