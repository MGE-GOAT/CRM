"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Form wrapper that runs a server action, shows an inline error if it throws,
 * and only calls onDone() on success (so modals don't close on failure).
 */
export function ModalForm({
  action,
  onDone,
  children,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  onDone: () => void;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        setError(null);
        try {
          const result = await action(fd);
          if (result && result.error) {
            setError(result.error);
            return;
          }
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "خطایی رخ داد. دوباره تلاش کنید.");
        }
      }}
      className="space-y-4"
    >
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
        >
          {error}
        </p>
      )}
      {children}
    </form>
  );
}

const base =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/50";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(base, props.className)} />;
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return <textarea {...props} className={cn(base, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(base, props.className)} />;
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="btn-gold rounded-lg px-4 py-2 text-sm"
    >
      {pending ? "در حال ذخیره…" : children}
    </button>
  );
}
