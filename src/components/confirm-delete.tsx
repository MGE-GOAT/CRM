"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export function ConfirmDelete({
  onDelete,
  label = "حذف",
  iconOnly = false,
}: {
  onDelete: () => Promise<{ error?: string } | void>;
  label?: string;
  iconOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          <span className="text-muted">مطمئنید؟</span>
        )}
        <button
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await onDelete();
              if (res?.error) {
                setError(res.error);
                return;
              }
              setConfirming(false);
            })
          }
          disabled={pending}
          className="rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50"
        >
          {pending ? "…" : "بله"}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          className="rounded px-2 py-1 text-muted hover:bg-[var(--gold-tint)]"
        >
          خیر
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-red-50 hover:text-red-600"
      aria-label={label}
      title={label}
    >
      <Trash2 size={16} aria-hidden="true" />
      {!iconOnly && label}
    </button>
  );
}
