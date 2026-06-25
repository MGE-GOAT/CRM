"use client";

import { useState } from "react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

/** ISO yyyy-mm-dd from a JS Date using local parts (avoids TZ off-by-one). */
function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Jalali (Shamsi) date picker. Renders a hidden input `name` carrying an ISO
 * (Gregorian) date string so server actions can `new Date(value)` as before.
 */
export function DateField({
  name,
  defaultValue,
  placeholder = "انتخاب تاریخ",
}: {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  const [iso, setIso] = useState<string>(defaultValue ?? "");

  return (
    <>
      <input type="hidden" name={name} value={iso} />
      <DatePicker
        calendar={persian}
        locale={persian_fa}
        calendarPosition="bottom-right"
        value={iso ? new Date(iso) : ""}
        onChange={(d) => {
          const obj = d as DateObject | null;
          setIso(obj ? toIso(obj.toDate()) : "");
        }}
        inputClass="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        placeholder={placeholder}
        editable={false}
      />
    </>
  );
}
