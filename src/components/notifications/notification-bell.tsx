"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageSquare, CheckSquare, CalendarClock, X } from "lucide-react";
import { formatNumber, formatRelative } from "@/lib/format";

const POLL_MS = 12_000;
const TOAST_TTL_MS = 6_000;

type NotifType = "MESSAGE" | "TASK" | "REMINDER";

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
  read: boolean;
};

type FeedResponse = { unread: number; items: Notif[] };

const TYPE_ICON: Record<NotifType, typeof Bell> = {
  MESSAGE: MessageSquare,
  TASK: CheckSquare,
  REMINDER: CalendarClock,
};

const TYPE_LABEL: Record<NotifType, string> = {
  MESSAGE: "پیام",
  TASK: "وظیفه",
  REMINDER: "یادآوری",
};

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Notif[]>([]);

  const ref = useRef<HTMLDivElement>(null);
  // Ids already surfaced as a toast this session (avoids duplicate pop-ups).
  const seenRef = useRef<Set<string>>(new Set());
  // True until the first poll completes, so we don't toast the whole backlog.
  const primedRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const poll = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data: FeedResponse = await res.json();
      setItems(data.items);
      setUnread(data.unread);

      const unreadItems = data.items.filter((n) => !n.read);
      if (primedRef.current) {
        // Show a toast for each newly-arrived unread item not seen yet.
        const fresh = unreadItems.filter((n) => !seenRef.current.has(n.id));
        if (fresh.length > 0) {
          setToasts((prev) => [...fresh, ...prev].slice(0, 4));
        }
      }
      // Mark everything currently unread as seen so it won't re-toast.
      unreadItems.forEach((n) => seenRef.current.add(n.id));
      primedRef.current = true;
    } catch {
      // Network hiccup — silently retry on the next interval.
    }
  }, []);

  // Poll on an interval, and immediately when the tab becomes visible again.
  useEffect(() => {
    poll();
    const id = window.setInterval(poll, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  // Auto-dismiss toasts after their TTL.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => window.setTimeout(() => dismissToast(t.id), TOAST_TTL_MS));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const markRead = useCallback(async (ids?: string[]) => {
    const body = ids ? { ids } : { all: true };
    // Optimistic: flip locally, then persist.
    setItems((prev) =>
      prev.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)),
    );
    setUnread((prev) => (ids ? Math.max(0, prev - ids.length) : 0));
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Best-effort; the next poll reconciles server truth.
    }
  }, []);

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      // Opening the panel marks the currently-shown unread items as read.
      if (next) {
        const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
        if (unreadIds.length > 0) markRead(unreadIds);
      }
      return next;
    });
  }, [items, markRead]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggleOpen}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread > 0 ? `اعلان‌ها، ${formatNumber(unread)} خوانده‌نشده` : "اعلان‌ها"}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-[var(--gold-tint)] hover:text-text"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--gold-to)] px-1 text-[10px] font-bold leading-4 text-[#241a05]">
            {formatNumber(unread > 99 ? 99 : unread)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-30 mt-2 w-80 animate-in overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">اعلان‌ها</span>
            {items.some((n) => !n.read) && (
              <button
                onClick={() => markRead()}
                className="text-xs text-[var(--gold-ink)] hover:underline"
              >
                علامت‌گذاری همه به‌عنوان خوانده‌شده
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-faint">
                اعلانی وجود ندارد
              </div>
            ) : (
              <ul>
                {items.map((n) => {
                  const Icon = TYPE_ICON[n.type];
                  const inner = (
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]"
                        aria-hidden="true"
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium">{n.title}</span>
                          <span className="shrink-0 text-[11px] text-faint">
                            {formatRelative(n.createdAt)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                        )}
                        <span className="mt-1 inline-block text-[10px] text-faint">
                          {TYPE_LABEL[n.type]}
                        </span>
                      </div>
                      {!n.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold-to)]" aria-hidden="true" />
                      )}
                    </div>
                  );
                  const cls = `block border-b border-border last:border-0 hover:bg-[var(--gold-tint)] ${
                    n.read ? "" : "bg-[var(--gold-tint)]"
                  }`;
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link
                          href={n.href}
                          className={cls}
                          onClick={() => {
                            markRead([n.id]);
                            setOpen(false);
                          }}
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className={cls}>{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Notif[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 start-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = TYPE_ICON[t.type];
        const inner = (
          <div className="flex items-start gap-3 p-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]"
              aria-hidden="true"
            >
              <Icon size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              {t.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p>}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDismiss(t.id);
              }}
              aria-label="بستن اعلان"
              className="pointer-events-auto -m-1 shrink-0 rounded p-1 text-faint hover:text-text"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
        const cls =
          "pointer-events-auto animate-in overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]";
        return t.href ? (
          <Link key={t.id} href={t.href} className={cls} onClick={() => onDismiss(t.id)}>
            {inner}
          </Link>
        ) : (
          <div key={t.id} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
