"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

export type ComboOption = { value: string; label: string };

/**
 * Searchable single-select. Filters options by case-insensitive SUBSTRING match
 * anywhere in the label (native <select> only jumps by leading letters). RTL.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "جستجو…",
  emptyOptionLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboOption[];
  placeholder?: string;
  /** When set, a first row that clears the selection (e.g. "— بدون مخاطب —"). */
  emptyOptionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const norm = (s: string) => s.trim().toLowerCase();
  const q = norm(query);
  const filtered = q ? options.filter((o) => norm(o.label).includes(q)) : options;

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 pe-9 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/40";

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={open ? query : selected?.label ?? ""}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        className={inputCls}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 end-3 my-auto text-muted"
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface py-1 shadow-[var(--shadow-lg)]">
          {emptyOptionLabel && (
            <li>
              <button
                type="button"
                onClick={() => pick("")}
                className="flex w-full items-center justify-between px-3 py-2 text-start text-sm text-muted hover:bg-[var(--gold-tint)]"
              >
                {emptyOptionLabel}
                {!value && <Check size={14} aria-hidden="true" />}
              </button>
            </li>
          )}
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => pick(o.value)}
                className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-[var(--gold-tint)]"
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check size={14} className="shrink-0 text-[color:var(--gold-ink)]" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-3 text-center text-sm text-muted">موردی یافت نشد</li>
          )}
        </ul>
      )}
    </div>
  );
}
