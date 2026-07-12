"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, refreshCaptcha } from "@/lib/actions/auth-actions";
import { PasswordInput } from "@/components/ui/password-input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-gold w-full rounded-lg py-2.5 text-sm"
    >
      {pending ? "در حال ورود…" : "ورود"}
    </button>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-start text-sm outline-none transition placeholder:text-faint focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/40";

export function LoginForm() {
  const [state, formAction] = useActionState(authenticate, undefined);
  const [captcha, setCaptcha] = useState<{ image: string; token: string } | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  // Show / refresh the CAPTCHA whenever the server says one is required.
  useEffect(() => {
    if (state?.captchaRequired && state.captchaImage && state.captchaToken) {
      setCaptcha({ image: state.captchaImage, token: state.captchaToken });
    }
  }, [state]);

  function handleRefresh() {
    startRefresh(async () => {
      const next = await refreshCaptcha();
      setCaptcha(next);
    });
  }

  return (
    <form action={formAction} className="relative space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          ایمیل
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          className={inputClass}
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          گذرواژه
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          className={inputClass}
          placeholder="••••••••"
        />
      </div>

      {/* Honeypot: in the DOM so bots auto-fill it, but visually hidden from
          humans. Uses the clip technique (NOT left:-9999px, which causes
          horizontal overflow / a shifted layout on mobile RTL). */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <label htmlFor="company_website">Company website</label>
        <input
          id="company_website"
          name="company_website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {captcha && (
        <div>
          <label htmlFor="captcha" className="block text-sm font-medium">
            کد امنیتی تصویر را وارد کنید
          </label>
          <div className="mt-1 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captcha.image}
              alt="کد امنیتی"
              width={170}
              height={56}
              className="rounded-lg border border-border"
            />
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="تصویر جدید"
              className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm text-muted transition hover:bg-[var(--gold-tint)] disabled:opacity-50"
            >
              ⟳
            </button>
          </div>
          <input type="hidden" name="captchaToken" value={captcha.token} />
          <input
            id="captcha"
            name="captcha"
            type="text"
            required
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            dir="ltr"
            className={inputClass}
            placeholder="مثلاً 7XK2P"
          />
        </div>
      )}

      {state?.error && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
