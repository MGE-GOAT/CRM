"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { checkSourceEntry, uncheckSourceEntry } from "@/lib/actions/factors";

export function SourceCheck({
  entryId,
  checked,
}: {
  entryId: string;
  checked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  };

  if (checked) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
          <Check size={14} aria-hidden="true" /> آرشیو شد
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => uncheckSourceEntry(entryId))}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-surface-2"
        >
          <RotateCcw size={13} aria-hidden="true" /> بازگردانی
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => checkSourceEntry(entryId))}
        className="btn-gold inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs"
      >
        <Check size={14} aria-hidden="true" /> علامت انجام‌شده
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
