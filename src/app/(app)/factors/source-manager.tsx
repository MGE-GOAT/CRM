"use client";

import { useState, useTransition } from "react";
import { SOURCE_LABEL } from "@/lib/factor";
import { setSourceEnabled } from "@/lib/actions/factors";
import type { SourceKind } from "@prisma/client";

type SourceState = { key: SourceKind; enabled: boolean };

export function SourceManager({ sources }: { sources: SourceState[] }) {
  const [items, setItems] = useState(sources);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: SourceKind, enabled: boolean) => {
    setError(null);
    // Optimistic update, rolled back on failure.
    setItems((prev) => prev.map((s) => (s.key === key ? { ...s, enabled } : s)));
    startTransition(async () => {
      const res = await setSourceEnabled(key, enabled);
      if (res && res.error) {
        setError(res.error);
        setItems((prev) => prev.map((s) => (s.key === key ? { ...s, enabled: !enabled } : s)));
      }
    });
  };

  return (
    <div className="panel p-4">
      <h2 className="mb-3 font-bold tracking-tight">منابع ارسال فعال</h2>
      {error && (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <label
            key={s.key}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={s.enabled}
              disabled={pending}
              onChange={(e) => toggle(s.key, e.target.checked)}
            />
            {SOURCE_LABEL[s.key]}
          </label>
        ))}
      </div>
    </div>
  );
}
