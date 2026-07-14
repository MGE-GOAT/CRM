"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";

/**
 * Export a factor as PDF and share it OUT of the app: uses the Web Share API
 * (WhatsApp/Telegram/email/…) when the device supports sharing files, otherwise
 * downloads the PDF.
 */
export function FactorShareButton({ factorId, number }: { factorId: string; number: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function shareOrDownload() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/factors/${factorId}/pdf`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "ساخت PDF ناموفق بود.");
      }
      const blob = await res.blob();
      const fileName = `factor-${number}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: `فاکتور ${number}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // A user cancelling the native share sheet throws AbortError — not an error.
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "خطا رخ داد.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={shareOrDownload}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
        ) : (
          <Share2 size={16} aria-hidden="true" />
        )}
        اشتراک‌گذاری PDF
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
