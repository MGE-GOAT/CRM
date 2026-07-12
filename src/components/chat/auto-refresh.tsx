"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Lightweight polling: refreshes the server component every `interval` ms so a
 * user sees new data without a manual refresh. Skips while the tab is hidden and
 * while a print dialog is open (a refresh mid-print could re-render the page
 * being printed — e.g. a factor invoice).
 */
export function AutoRefresh({ interval = 4000 }: { interval?: number }) {
  const router = useRouter();
  const printingRef = useRef(false);

  useEffect(() => {
    const onBeforePrint = () => (printingRef.current = true);
    const onAfterPrint = () => (printingRef.current = false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);

    const id = setInterval(() => {
      if (printingRef.current) return;
      if (typeof window.matchMedia === "function" && window.matchMedia("print").matches) return;
      if (document.visibilityState === "visible") router.refresh();
    }, interval);

    return () => {
      clearInterval(id);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [router, interval]);

  return null;
}
