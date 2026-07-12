"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type FeedResponse = { activeCount: number; active: Notif[]; archived: Notif[] };

type Ctx = {
  active: Notif[];
  archived: Notif[];
  activeCount: number;
  /** Acknowledge ("مشاهده شد"): ids, or all when omitted. */
  acknowledge: (ids?: string[]) => Promise<void>;
  /** Count of unseen notifs whose link belongs to a given nav section. */
  sectionCount: (navHref: string) => number;
};

const NotificationsContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

/** Map a notification's href to the nav item it belongs under (Slack-style). */
export function navKeyFor(href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("/chat")) return "/chat";
  if (href.startsWith("/factors/sent")) return "/factors/sent";
  if (href.startsWith("/factors")) return "/factors";
  if (href.startsWith("/tasks")) return "/tasks";
  if (href.startsWith("/calendar")) return "/calendar";
  if (href.startsWith("/contacts")) return "/contacts";
  if (href.startsWith("/companies")) return "/companies";
  if (href.startsWith("/settings")) return "/settings/users";
  if (href === "/" || href.startsWith("/reports")) return "/";
  return null;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Notif[]>([]);
  const [archived, setArchived] = useState<Notif[]>([]);

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      setActive(data.active);
      setArchived(data.archived);
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

  const acknowledge = useCallback(async (ids?: string[]) => {
    setActive((prev) => {
      const acked = ids ? prev.filter((n) => ids.includes(n.id)) : prev;
      const remaining = ids ? prev.filter((n) => !ids.includes(n.id)) : [];
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

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of active) {
      const key = navKeyFor(n.href);
      if (key) map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [active]);

  const sectionCount = useCallback((navHref: string) => counts[navHref] ?? 0, [counts]);

  const value = useMemo<Ctx>(
    () => ({ active, archived, activeCount: active.length, acknowledge, sectionCount }),
    [active, archived, acknowledge, sectionCount],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
