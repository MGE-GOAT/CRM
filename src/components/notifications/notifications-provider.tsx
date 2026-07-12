"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { navKeyFor } from "@/lib/notif-nav";

// Re-export so existing consumers (mobile-nav) keep importing it from here.
export { navKeyFor };

const POLL_MS = 12_000;
const ARCHIVE_MAX = 30;

export type NotifType = "MESSAGE" | "TASK" | "REMINDER";

export type Notif = {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
};

type FeedResponse = {
  activeCount: number;
  active: Notif[];
  archived: Notif[];
  sectionCounts: Record<string, number>;
};

type Ctx = {
  active: Notif[];
  archived: Notif[];
  activeCount: number;
  /** Acknowledge ("مشاهده شد"): ids, or all when omitted. */
  acknowledge: (ids?: string[]) => Promise<void>;
  /**
   * Unseen count for a nav section. Driven by whether the page has been
   * *opened*, NOT by acknowledgement — so «مشاهده شد» never clears these.
   */
  sectionCount: (navHref: string) => number;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Notif[]>([]);
  const [archived, setArchived] = useState<Notif[]>([]);
  // Exact server-side unread count (the `active` list itself is capped at 50).
  const [activeCount, setActiveCount] = useState(0);
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const pathname = usePathname();

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      setActive(data.active);
      setArchived(data.archived);
      setActiveCount(data.activeCount ?? data.active.length);
      setSectionCounts(data.sectionCounts ?? {});
    } catch {
      /* transient — next tick retries */
    }
  }, []);

  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  // Visiting a page clears that section's badge ("open and see the thing").
  // Guard against re-posting the same section repeatedly across renders.
  const lastViewed = useRef<string | null>(null);
  useEffect(() => {
    const key = navKeyFor(pathname);
    if (!key || lastViewed.current === key) return;
    lastViewed.current = key;
    // Optimistically clear; server reconciles on the next poll.
    setSectionCounts((prev) => (prev[key] ? { ...prev, [key]: 0 } : prev));
    fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: pathname }),
    }).catch(() => {
      /* best-effort; next poll reconciles */
    });
  }, [pathname]);

  const acknowledge = useCallback(async (ids?: string[]) => {
    setActive((prev) => {
      const acked = ids ? prev.filter((n) => ids.includes(n.id)) : prev;
      const remaining = ids ? prev.filter((n) => !ids.includes(n.id)) : [];
      // Keep the exact count in step optimistically: acking specific ids drops
      // by that many; acking all zeroes it (even beyond the 50-row window).
      setActiveCount((c) => (ids ? Math.max(0, c - acked.length) : 0));
      setArchived((a) =>
        [...acked.map((n) => ({ ...n, read: true })), ...a].slice(0, ARCHIVE_MAX),
      );
      return remaining;
    });
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids ? { ids } : { all: true }),
      });
    } catch {
      /* best-effort; next poll reconciles */
    }
  }, []);

  const sectionCount = useCallback(
    (navHref: string) => sectionCounts[navHref] ?? 0,
    [sectionCounts],
  );

  const value = useMemo<Ctx>(
    () => ({ active, archived, activeCount, acknowledge, sectionCount }),
    [active, archived, activeCount, acknowledge, sectionCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
