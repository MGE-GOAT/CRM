"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";

export function DuplicateButton({
  onDuplicate,
  label = "تکثیر",
}: {
  onDuplicate: () => Promise<{ error?: string } | void>;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => { void onDuplicate(); })}
      disabled={pending}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-muted hover:bg-gray-50 hover:text-text disabled:opacity-50"
    >
      <Copy size={16} aria-hidden="true" />
    </button>
  );
}
