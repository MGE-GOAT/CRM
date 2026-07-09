"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

/** A URL-param-backed dropdown filter (e.g. filter contacts by company). */
export function SelectFilter({
  param,
  options,
  allLabel,
}: {
  param: string;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const current = sp.get(param) ?? "";

  return (
    <select
      value={current}
      onChange={(e) => {
        const next = new URLSearchParams(sp.toString());
        if (e.target.value) next.set(param, e.target.value);
        else next.delete(param);
        next.delete("page"); // changing a filter must start from page 1
        router.replace(`${pathname}?${next.toString()}`);
      }}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/50"
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
