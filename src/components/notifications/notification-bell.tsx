"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  MessageSquare,
  CheckSquare,
  CalendarClock,
  Check,
  CheckCheck,
  AlertTriangle,
  ListChecks,
  X,
} from "lucide-react";
import { formatNumber, formatRelative } from "@/lib/format";
import { useNotifications, type Notif, type NotifType } from "./notifications-provider";

const STACK_VISIBLE = 4; // unseen cards shown before collapsing into "manage"
const BANNER_AT = 5; // persistent banner when this many go unseen
const BLOCK_AT = 10; // blocking overlay when this many go unseen
const BELL_LIMIT = 30; // full inbox history kept in the bell (seen + unseen)

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
  const { active, archived, activeCount, acknowledge } = useNotifications();
  const [bellOpen, setBellOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);
  // The blocker opens at 10 unseen; acknowledging ANY one (open it or tick it)
  // releases it. It re-arms once the user drops back below the threshold.
  const [blockDismissed, setBlockDismissed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bellRef = useRef<HTMLDivElement>(null);

  // Re-arm the dismissible disclaimer once the user drops back below the threshold.
  useEffect(() => {
    if (activeCount < BANNER_AT) setDisclaimerDismissed(false);
  }, [activeCount]);

  // Once back below the threshold, re-arm the blocker for next time it's hit.
  useEffect(() => {
    if (activeCount < BLOCK_AT) setBlockDismissed(false);
  }, [activeCount]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setBellOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const ack = (ids?: string[]) => {
    setSelected(new Set());
    return acknowledge(ids);
  };

  // Acknowledging while blocked releases the blocker (see one / check one).
  const ackAndRelease = (ids?: string[]) => {
    setBlockDismissed(true);
    return ack(ids);
  };

  const showBanner = activeCount >= BANNER_AT && activeCount < BLOCK_AT;
  const showBlock = activeCount >= BLOCK_AT && !blockDismissed;

  // The bell is a full inbox: every notification (seen or unseen), newest first,
  // capped at BELL_LIMIT. Unseen rows are marked and stay acknowledge-able here.
  const bellItems = useMemo(() => {
    const byId = new Map<string, Notif>();
    for (const n of [...active, ...archived]) byId.set(n.id, n);
    return [...byId.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, BELL_LIMIT);
  }, [active, archived]);

  return (
    <>
      {/* Bell — badge = unseen count; dropdown = seen history (archive, max 30). */}
      <div className="relative" ref={bellRef}>
        <button
          onClick={() => setBellOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={bellOpen}
          aria-label={activeCount > 0 ? `اعلان‌ها، ${formatNumber(activeCount)} دیده‌نشده` : "اعلان‌ها"}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-[var(--gold-tint)] hover:text-text"
        >
          <Bell size={20} aria-hidden="true" />
          {activeCount > 0 && (
            <span className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-[var(--gold-to)] px-1 text-[10px] font-bold leading-4 text-[#241a05]">
              {formatNumber(activeCount > 99 ? 99 : activeCount)}
            </span>
          )}
        </button>

        {bellOpen && (
          <div
            role="menu"
            className="absolute end-0 z-30 mt-2 w-80 animate-in overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">اعلان‌ها</span>
              {activeCount > 0 && (
                <button
                  onClick={() => {
                    setManageOpen(true);
                    setBellOpen(false);
                  }}
                  className="text-xs text-[var(--gold-ink)] hover:underline"
                >
                  {formatNumber(activeCount)} دیده‌نشده
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {bellItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-faint">اعلانی وجود ندارد</div>
              ) : (
                <ul>
                  {bellItems.map((n) => (
                    <SeenRow
                      key={n.id}
                      n={n}
                      onNavigate={() => setBellOpen(false)}
                      onAck={n.read ? undefined : () => ack([n.id])}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Persistent stack of unseen notifs (bottom-left, clear of the sidebar). */}
      {!showBlock && activeCount > 0 && !manageOpen && (
        <div className="pointer-events-none fixed bottom-4 left-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
          {active.slice(0, STACK_VISIBLE).map((n) => (
            <ActiveCard key={n.id} n={n} onAck={() => ack([n.id])} />
          ))}
          {activeCount > STACK_VISIBLE && (
            <button
              onClick={() => setManageOpen(true)}
              className="pointer-events-auto self-start rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted shadow-[var(--shadow-md)] hover:bg-surface-2"
            >
              و {formatNumber(activeCount - STACK_VISIBLE)} مورد دیگر — مدیریت همه
            </button>
          )}
        </div>
      )}

      {/* Compact, dismissible disclaimer (5–9 unseen) — palette-matched. */}
      {showBanner && !disclaimerDismissed && (
        <div className="fixed left-1/2 top-20 z-30 flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-xl border border-[color:var(--gold-hair)] bg-[var(--gold-tint)] px-3.5 py-2.5 text-sm text-[color:var(--gold-ink)] shadow-[var(--shadow-md)]">
          <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            {formatNumber(activeCount)} اعلان دیده‌نشده دارید.
          </span>
          <button
            onClick={() => setManageOpen(true)}
            className="shrink-0 rounded-lg bg-[color:var(--gold-ink)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
          >
            بررسی
          </button>
          <button
            onClick={() => setDisclaimerDismissed(true)}
            aria-label="بستن"
            className="shrink-0 -me-1 rounded p-1 text-[color:var(--gold-ink)]/70 hover:text-[color:var(--gold-ink)]"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Manage panel — bottom-left when opened normally, or a blocking modal at
          10+ unseen (the menu itself blocks until they're reviewed & cleared). */}
      {(manageOpen || showBlock) && (
        <ManagePanel
          items={active}
          selected={selected}
          setSelected={setSelected}
          onAck={showBlock ? ackAndRelease : ack}
          blocking={showBlock}
          onOpen={(id) => ackAndRelease([id])}
          onClose={() => setManageOpen(false)}
        />
      )}
    </>
  );
}

/** A persistent unseen card with an explicit «مشاهده شد» + click-through. */
function ActiveCard({ n, onAck }: { n: Notif; onAck: () => void }) {
  const Icon = TYPE_ICON[n.type];
  const inner = (
    <div className="flex items-start gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{n.title}</div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAck();
            }}
            className="pointer-events-auto inline-flex items-center gap-1 rounded-lg bg-[color:var(--gold-ink)] px-2.5 py-1 text-xs font-medium text-white"
          >
            <Check size={13} aria-hidden="true" /> مشاهده شد
          </button>
          <span className="text-[10px] text-faint">{formatRelative(n.createdAt)}</span>
        </div>
      </div>
    </div>
  );
  const cls =
    "pointer-events-auto animate-in overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]";
  // Clicking the card body navigates AND acknowledges (viewing = seen).
  return n.href ? (
    <Link href={n.href} className={cls} onClick={() => onAck()}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/**
 * A row in the bell inbox. Seen rows are read-only; unseen rows (onAck given)
 * get a gold "unseen" dot and an inline «مشاهده شد». Clicking an unseen row's
 * body navigates AND acknowledges it.
 */
function SeenRow({
  n,
  onNavigate,
  onAck,
}: {
  n: Notif;
  onNavigate?: () => void;
  onAck?: () => void;
}) {
  const Icon = TYPE_ICON[n.type];
  const unseen = !n.read;
  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]" aria-hidden="true">
        <Icon size={16} />
        {unseen && (
          <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--gold-to)] ring-2 ring-[var(--surface)]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unseen ? "font-bold" : "font-medium"}`}>{n.title}</span>
          <span className="shrink-0 text-[11px] text-faint">{formatRelative(n.createdAt)}</span>
        </div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10px] text-faint">{TYPE_LABEL[n.type]}</span>
          {unseen && onAck && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAck();
              }}
              className="inline-flex items-center gap-1 rounded text-[10px] font-medium text-[var(--gold-ink)] hover:underline"
            >
              <Check size={11} aria-hidden="true" /> مشاهده شد
            </button>
          )}
        </div>
      </div>
    </div>
  );
  const cls = "block border-b border-border last:border-0 hover:bg-[var(--gold-tint)]";
  return (
    <li>
      {n.href ? (
        <Link
          href={n.href}
          className={cls}
          onClick={() => {
            onAck?.();
            onNavigate?.();
          }}
        >
          {inner}
        </Link>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  );
}

/** Checkbox-bulk list of unseen notifs (like the contacts multi-select). */
function SelectableList({
  items,
  selected,
  setSelected,
  onOpen,
}: {
  items: Notif[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  /** Opening a notification's link counts as seeing it (acks just that one). */
  onOpen?: (id: string) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const Icon = TYPE_ICON[n.type];
        return (
          <li key={n.id} className="flex items-start gap-2.5 px-4 py-2.5">
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              onChange={() => toggle(n.id)}
              className="mt-1 accent-[var(--gold-ink)]"
              aria-label={`انتخاب ${n.title}`}
            />
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]" aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                {n.href ? (
                  <Link
                    href={n.href}
                    onClick={() => onOpen?.(n.id)}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {n.title}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">{n.title}</span>
                )}
                <span className="shrink-0 text-[11px] text-faint">{formatRelative(n.createdAt)}</span>
              </div>
              {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function BulkBar({
  items,
  selected,
  setSelected,
  onAck,
}: {
  items: Notif[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onAck: (ids?: string[]) => void;
}) {
  const allSelected = useMemo(
    () => items.length > 0 && items.every((n) => selected.has(n.id)),
    [items, selected],
  );
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-4 py-2.5">
      <label className="inline-flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((n) => n.id)))}
          className="accent-[var(--gold-ink)]"
        />
        انتخاب همه
      </label>
      <div className="ms-auto flex items-center gap-2">
        {selected.size > 0 && (
          <button
            onClick={() => onAck([...selected])}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--gold-tint)]"
          >
            <Check size={13} aria-hidden="true" /> مشاهدهٔ انتخاب‌شده‌ها ({formatNumber(selected.size)})
          </button>
        )}
        <button
          onClick={() => onAck()}
          className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--gold-ink)] px-2.5 py-1.5 text-xs font-medium text-white"
        >
          <CheckCheck size={13} aria-hidden="true" /> مشاهدهٔ همه
        </button>
      </div>
    </div>
  );
}

/**
 * The unseen-notifications menu (checkbox bulk, like the contacts list).
 * - normal: a panel docked bottom-left with a «بستن».
 * - blocking (10+ unseen): the same menu, centered over a dim backdrop with no
 *   close — it stays until the user reviews & clears enough to drop below 10.
 */
function ManagePanel({
  items,
  selected,
  setSelected,
  onAck,
  onOpen,
  onClose,
  blocking = false,
}: {
  items: Notif[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onAck: (ids?: string[]) => void;
  onOpen?: (id: string) => void;
  onClose: () => void;
  blocking?: boolean;
}) {
  const panel = (
    <div
      className={
        blocking
          ? "flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]"
          : "fixed bottom-4 left-4 z-50 flex max-h-[70vh] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--gold-hair)] bg-[var(--gold-tint)] px-4 py-3">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-[color:var(--gold-ink)]">
          <ListChecks size={15} aria-hidden="true" /> اعلان‌های دیده‌نشده ({formatNumber(items.length)})
        </h3>
        {blocking ? (
          <span className="text-xs text-[color:var(--gold-ink)]/80">برای ادامه، بررسی و تأیید کنید</span>
        ) : (
          <button onClick={onClose} className="text-xs text-[color:var(--gold-ink)] hover:underline">
            بستن
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <SelectableList
          items={items}
          selected={selected}
          setSelected={setSelected}
          onOpen={onOpen}
        />
      </div>
      <BulkBar items={items} selected={selected} setSelected={setSelected} onAck={onAck} />
    </div>
  );

  if (!blocking) return panel;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[color:var(--gold-ink)]/25 p-4 backdrop-blur-sm">
      {panel}
    </div>
  );
}
