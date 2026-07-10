"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  trigger,
  title,
  children,
  wide,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  children: (close: () => void) => React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const openModal = useCallback(() => {
    lastFocused.current = document.activeElement as HTMLElement;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    lastFocused.current?.focus?.();
  }, []);

  // Move focus into the dialog when it opens + lock background scroll.
  useEffect(() => {
    if (!open) return;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close + trap Tab inside the dialog.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const els = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []
      );
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {trigger(openModal)}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-4 md:p-8">
          <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "relative z-10 my-8 w-full animate-in rounded-2xl bg-surface shadow-xl",
              wide ? "max-w-2xl" : "max-w-md"
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 id={titleId} className="font-semibold">
                {title}
              </h3>
              <button
                onClick={close}
                className="rounded-lg p-1 text-muted hover:bg-[var(--gold-tint)]"
                aria-label="بستن"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">{children(close)}</div>
          </div>
        </div>
      )}
    </>
  );
}
