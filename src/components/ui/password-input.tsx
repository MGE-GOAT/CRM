"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/50";

/**
 * Password field with a show/hide toggle. Forwards all standard input props;
 * the `type` is controlled internally (text ↔ password). Password entry is
 * always LTR regardless of page direction.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    // Force LTR on the wrapper so the toggle sits on the right and the reserved
    // right padding (pr-11) lines up with it — the password text is LTR too, so
    // it grows from the left and never runs under the icon.
    <div className="relative" dir="ltr">
      <input
        {...props}
        type={visible ? "text" : "password"}
        dir="ltr"
        // pr-11 appended last so the caller's own px can't override the space
        // reserved for the toggle button.
        className={cn(base, className, "pr-11")}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"}
        title={visible ? "پنهان کردن گذرواژه" : "نمایش گذرواژه"}
        className="absolute inset-y-0 right-0 z-10 grid w-11 place-items-center text-[color:var(--muted)] hover:text-[color:var(--gold-ink)]"
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
