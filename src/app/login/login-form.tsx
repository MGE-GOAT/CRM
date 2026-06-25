"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate } from "@/lib/actions/auth-actions";

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

export function LoginForm() {
  const [error, formAction] = useActionState(authenticate, undefined);

  return (
    <form action={formAction} className="space-y-4">
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
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          گذرواژه
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          dir="ltr"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-left outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
