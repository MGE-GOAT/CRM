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
} from "lucide-react";
import { formatNumber, formatRelative } from "@/lib/format";
import { useNotifications, type Notif, type NotifType } from "./notifications-provider";

const STACK_VISIBLE = 4; // unseen cards shown before collapsing into "manage"
const BANNER_AT = 5; // persistent banner when this many go unseen
const BLOCK_AT = 10; // blocking overlay when this many go unseen

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const bellRef = useRef<HTMLDivElement>(null);

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

  const showBanner = activeCount >= BANNER_AT && activeCount < BLOCK_AT;
  const showBlock = activeCount >= BLOCK_AT;

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
              <span className="text-sm font-semibold">اعلان‌های دیده‌شده</span>
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
              {archived.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-faint">اعلانی وجود ندارد</div>
              ) : (
                <ul>
                  {archived.map((n) => (
                    <SeenRow key={n.id} n={n} onNavigate={() => setBellOpen(false)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Persistent stack of unseen notifs (bottom-start). */}
      {!showBlock && activeCount > 0 && !manageOpen && (
        <div className="pointer-events-none fixed bottom-4 start-4 z-40 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
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

      {/* Escalation banner (5+ unseen) — sits below the 64px app header so the
          bell/menu stay clickable. */}
      {showBanner && (
        <div className="fixed inset-x-0 top-16 z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-red-600 px-4 py-2 text-sm font-medium text-white">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{formatNumber(activeCount)} اعلان دیده‌نشده دارید. لطفاً بررسی کنید.</span>
          <button
            onClick={() => setManageOpen(true)}
            className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30"
          >
            بررسی اعلان‌ها
          </button>
        </div>
      )}

      {/* Manage panel (checkbox bulk, like contacts). */}
      {manageOpen && !showBlock && (
        <ManagePanel
          items={active}
          selected={selected}
          setSelected={setSelected}
          onAck={ack}
          onClose={() => setManageOpen(false)}
        />
      )}

      {/* Blocking overlay (10+ unseen) — must review to continue. */}
      {showBlock && (
        <BlockOverlay items={active} selected={selected} setSelected={setSelected} onAck={ack} />
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

/** Read-only row for the bell's seen history. */
function SeenRow({ n, onNavigate }: { n: Notif; onNavigate?: () => void }) {
  const Icon = TYPE_ICON[n.type];
  const inner = (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-tint)] text-[var(--gold-ink)]" aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{n.title}</span>
          <span className="shrink-0 text-[11px] text-faint">{formatRelative(n.createdAt)}</span>
        </div>
        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
        <span className="mt-1 inline-block text-[10px] text-faint">{TYPE_LABEL[n.type]}</span>
      </div>
    </div>
  );
  const cls = "block border-b border-border last:border-0 hover:bg-[var(--gold-tint)]";
  return (
    <li>
      {n.href ? (
        <Link href={n.href} className={cls} onClick={onNavigate}>
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
}: {
  items: Notif[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
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
                  <Link href={n.href} className="truncate text-sm font-medium hover:underline">
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

function ManagePanel({
  items,
  selected,
  setSelected,
  onAck,
  onClose,
}: {
  items: Notif[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onAck: (ids?: string[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-4 start-4 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-lg)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-bold">
          <ListChecks size={15} aria-hidden="true" /> اعلان‌های دیده‌نشده ({formatNumber(items.length)})
        </h3>
        <button onClick={onClose} className="text-xs text-muted hover:text-text">
          بستن
        </button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        <SelectableList items={items} selected={selected} setSelected={setSelected} />
      </div>
      <BulkBar items={items} selected={selected} setSelected={setSelected} onAck={onAck} />
    </div>
  );
}

function BlockOverlay({
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
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-border bg-red-600 px-4 py-3 text-white">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <div className="text-sm font-bold">لطفاً اعلان‌های دیده‌نشدهٔ خود را بررسی کنید</div>
            <div className="text-xs text-white/90">
              {formatNumber(items.length)} اعلان دیده‌نشده دارید. برای ادامهٔ کار، آن‌ها را تأیید کنید.
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SelectableList items={items} selected={selected} setSelected={setSelected} />
        </div>
        <BulkBar items={items} selected={selected} setSelected={setSelected} onAck={onAck} />
      </div>
    </div>
  );
}
