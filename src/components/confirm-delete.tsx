"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

export function ConfirmDelete({
  onDelete,
  label = "حذف",
  iconOnly = false,
}: {
  onDelete: () => Promise<void>;
  label?: string;
  iconOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <span className="text-muted">مطمئنید؟</span>
        <button
          onClick={() => start(() => onDelete())}
          disabled={pending}
          className="rounded px-2 py-1 font-medium text-red-600 hover:bg-red-50"
        >
          {pending ? "…" : "بله"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-muted hover:bg-gray-50"
        >
          خیر
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex min-h-6 min-w-6 items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-red-50 hover:text-red-600"
      aria-label={label}
      title={label}
    >
      <Trash2 size={16} aria-hidden="true" />
      {!iconOnly && label}
    </button>
  );
}
