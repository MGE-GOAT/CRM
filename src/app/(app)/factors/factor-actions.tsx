"use client";

import { useState, useTransition } from "react";
import { Printer, Check, CreditCard, Send, Trash2, Ban, RotateCcw } from "lucide-react";
import { SOURCE_LABEL } from "@/lib/factor";
import {
  confirmFactor,
  markFactorPaid,
  sendFactor,
  deleteFactor,
  cancelFactor,
  reopenFactor,
} from "@/lib/actions/factors";
import type { SourceKind } from "@prisma/client";
import { useRouter } from "next/navigation";

type Perms = {
  factorId: string;
  canConfirm: boolean; // owner, state INITIAL
  canPay: boolean; // creator or owner, state FOLLOWING_UP
  canSend: boolean; // owner, state PAID
  canCancel: boolean; // creator or owner, state INITIAL/FOLLOWING_UP
  canReopen: boolean; // creator or owner, state CANCELED
  canDelete: boolean;
  enabledSources: SourceKind[];
};

export function FactorActions({
  factorId,
  canConfirm,
  canPay,
  canSend,
  canCancel,
  canReopen,
  canDelete,
  enabledSources,
}: Perms) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [picked, setPicked] = useState<SourceKind[]>([]);

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  };

  const toggleSource = (s: SourceKind) =>
    setPicked((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const submitSend = () => {
    if (picked.length === 0) {
      setError("حداقل یک منبع را انتخاب کنید.");
      return;
    }
    run(() => sendFactor(factorId, picked));
  };

  return (
    <div className="no-print space-y-3">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
        >
          <Printer size={16} aria-hidden="true" /> چاپ
        </button>

        {canConfirm && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => confirmFactor(factorId))}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <Check size={16} aria-hidden="true" /> تأیید پیش‌فاکتور
          </button>
        )}

        {canPay && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markFactorPaid(factorId))}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <CreditCard size={16} aria-hidden="true" /> ثبت پرداخت
          </button>
        )}

        {canSend && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowSend((s) => !s)}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
          >
            <Send size={16} aria-hidden="true" /> تأیید پرداخت و ارسال
          </button>
        )}

        {canReopen && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reopenFactor(factorId))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
          >
            <RotateCcw size={16} aria-hidden="true" /> بازگردانی به پیگیری
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("این پیش‌فاکتور به دلیل عدم پرداخت لغو شود؟"))
                run(() => cancelFactor(factorId));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Ban size={16} aria-hidden="true" /> لغو (عدم پرداخت)
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm("این فاکتور حذف شود؟")) run(() => deleteFactor(factorId));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} aria-hidden="true" /> حذف
          </button>
        )}
      </div>

      {canSend && showSend && (
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 text-sm font-medium">انتخاب منبع(های) ارسال</p>
          {enabledSources.length === 0 ? (
            <p className="text-sm text-muted">هیچ منبعی فعال نیست.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enabledSources.map((s) => (
                <label
                  key={s}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={picked.includes(s)}
                    onChange={() => toggleSource(s)}
                  />
                  {SOURCE_LABEL[s]}
                </label>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={pending || enabledSources.length === 0}
              onClick={submitSend}
              className="btn-gold rounded-lg px-4 py-2 text-sm"
            >
              ارسال
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
