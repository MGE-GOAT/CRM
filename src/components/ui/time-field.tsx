"use client";

import { useState } from "react";
import { toFa } from "@/lib/format";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const selectClass =
  "rounded-lg border border-border bg-surface px-2 py-2 text-sm tabular-nums outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/40";

/**
 * A guaranteed 24-hour time picker (two Farsi-labelled selects) — unlike the
 * native <input type="time">, which renders 12-hour AM/PM under an English
 * browser locale and confuses Iranian users. Submits "HH:MM" (Latin) via a
 * hidden input so server parsing (regex \d{2}:\d{2}) is unchanged.
 */
export function TimeField({
  name,
  defaultValue = "09:00",
  onChange,
}: {
  /** When provided, a hidden input submits "HH:MM" for form use. */
  name?: string;
  defaultValue?: string;
  /** Fired with "HH:MM" on every change (for controlled/non-form use). */
  onChange?: (value: string) => void;
}) {
  const [h0, m0] = (defaultValue || "09:00").split(":");
  const [hour, setHour] = useState(HOURS.includes(h0) ? h0 : "09");
  const [minute, setMinute] = useState(MINUTES.includes(m0) ? m0 : "00");

  const emit = (h: string, m: string) => onChange?.(`${h}:${m}`);

  return (
    <>
      {name && <input type="hidden" name={name} value={`${hour}:${minute}`} />}
      <div className="flex items-center gap-1.5" dir="ltr">
        <select
          aria-label="ساعت"
          value={hour}
          onChange={(e) => {
            setHour(e.target.value);
            emit(e.target.value, minute);
          }}
          className={selectClass}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {toFa(h)}
            </option>
          ))}
        </select>
        <span className="text-muted">:</span>
        <select
          aria-label="دقیقه"
          value={minute}
          onChange={(e) => {
            setMinute(e.target.value);
            emit(hour, e.target.value);
          }}
          className={selectClass}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {toFa(m)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
