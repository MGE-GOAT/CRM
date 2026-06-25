"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Lightweight polling: refreshes the server component every `interval` ms. */
export function AutoRefresh({ interval = 4000 }: { interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, interval);
    return () => clearInterval(id);
  }, [router, interval]);
  return null;
}
