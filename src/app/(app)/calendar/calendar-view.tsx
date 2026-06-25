"use client";

import { useState, useTransition } from "react";
import { DateObject } from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import {
  Plus,
  Phone,
  MessageCircle,
  Send,
  X,
  Check,
  Pencil,
  Trash2,
  Globe,
  Lock,
} from "lucide-react";
import { ReminderForm, type ContactOption } from "@/components/calendar/reminder-form";
import { toFa, toEn, toWhatsappNumber, formatTime } from "@/lib/format";
import {
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminderDone,
} from "@/lib/actions/reminders";

export type CalReminder = {
  id: string;
  title: string;
  description: string | null;
  date: string; // ISO
  isPublic: boolean;
  color: string;
  done: boolean;
  action: "GENERAL" | "CALL" | "WHATSAPP" | "SMS";
  messageBody: string | null;
  contactName: string | null;
  contactPhone: string | null;
  ownerName: string;
  canEdit: boolean;
};

const WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
const ACTION_LABEL: Record<string, string> = {
  GENERAL: "یادآوری",
  CALL: "تماس",
  WHATSAPP: "واتساپ",
  SMS: "پیامک",
};

function pj(date: Date) {
  return new DateObject({ calendar: persian, locale: persian_fa, date });
}
function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type ModalState =
  | { type: "none" }
  | { type: "add"; date: string }
  | { type: "edit"; reminder: CalReminder }
  | { type: "detail"; reminder: CalReminder };

export function CalendarView({
  reminders,
  contacts,
}: {
  reminders: CalReminder[];
  contacts: ContactOption[];
}) {
  const [view, setView] = useState(() => new DateObject({ calendar: persian, locale: persian_fa }));
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [, start] = useTransition();

  const today = pj(new Date());
  const todayKey = `${today.year}-${today.month.number}-${today.day}`;

  // group reminders by Jalali day
  const byDay = new Map<string, CalReminder[]>();
  for (const r of reminders) {
    const d = pj(new Date(r.date));
    const key = `${d.year}-${d.month.number}-${d.day}`;
    const arr = byDay.get(key) ?? [];
    arr.push(r);
    byDay.set(key, arr);
  }

  const first = new DateObject(view).toFirstOfMonth();
  const startBlanks = first.weekDay.index;
  const daysInMonth = view.month.length;
  const cells: (number | null)[] = [
    ...Array(startBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(dir: number) {
    const next = new DateObject({ calendar: persian, locale: persian_fa, date: view.toDate() });
    next.add(dir, "month");
    setView(next);
  }
  function gregorianForDay(day: number) {
    const d = new DateObject({
      calendar: persian,
      locale: persian_fa,
      year: view.year,
      month: view.month.number,
      day,
    });
    return isoLocal(d.toDate());
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftMonth(-1)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-gray-50">
            ماه قبل
          </button>
          <button onClick={() => setView(new DateObject({ calendar: persian, locale: persian_fa }))} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-gray-50">
            امروز
          </button>
          <button onClick={() => shiftMonth(1)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-gray-50">
            ماه بعد
          </button>
        </div>
        <h2 className="text-lg font-bold">
          {view.month.name} {toFa(view.year)}
        </h2>
        <button
          onClick={() => setModal({ type: "add", date: isoLocal(new Date()) })}
          className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm"
        >
          <Plus size={16} /> برنامهٔ جدید
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
       <div className="min-w-[680px] md:min-w-0">
        <div className="grid grid-cols-7 border-b border-border bg-gray-50 text-center text-xs font-medium text-muted">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-1 py-2">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} className="min-h-24 border-b border-s border-border bg-gray-50/40" />;
            const key = `${view.year}-${view.month.number}-${day}`;
            const dayReminders = byDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className="min-h-24 border-b border-s border-border p-1 transition hover:bg-gray-50/60"
              >
                <div className="flex items-center justify-between px-1">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                      isToday ? "bg-[var(--brand)] font-bold text-white" : "text-muted"
                    }`}
                  >
                    {toFa(day)}
                  </span>
                  <button
                    onClick={() => setModal({ type: "add", date: gregorianForDay(day) })}
                    aria-label="افزودن برنامه"
                    className="rounded p-0.5 text-muted opacity-0 transition hover:bg-gray-100 hover:text-text focus:opacity-100 [div:hover>div>&]:opacity-100"
                  >
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1 space-y-1">
                  {dayReminders.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setModal({ type: "detail", reminder: r })}
                      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-right text-[11px] hover:brightness-95"
                      style={{ backgroundColor: `${r.color}22` }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className={`truncate ${r.done ? "text-muted line-through" : ""}`}>{r.title}</span>
                    </button>
                  ))}
                  {dayReminders.length > 3 && (
                    <span className="block px-1 text-[10px] text-muted">+{toFa(dayReminders.length - 3)} مورد دیگر</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
       </div>
      </div>

      {/* Add / Edit modal */}
      {(modal.type === "add" || modal.type === "edit") && (
        <Overlay onClose={() => setModal({ type: "none" })} title={modal.type === "add" ? "برنامهٔ جدید" : "ویرایش برنامه"}>
          {modal.type === "add" ? (
            <ReminderForm action={createReminder} onDone={() => setModal({ type: "none" })} contacts={contacts} defaultDate={modal.date} />
          ) : (
            <ReminderForm
              action={updateReminder.bind(null, modal.reminder.id)}
              onDone={() => setModal({ type: "none" })}
              contacts={contacts}
              values={toFormValues(modal.reminder)}
            />
          )}
        </Overlay>
      )}

      {/* Detail modal */}
      {modal.type === "detail" && (
        <Overlay onClose={() => setModal({ type: "none" })} title={modal.reminder.title}>
          <DetailBody
            r={modal.reminder}
            onEdit={() => setModal({ type: "edit", reminder: modal.reminder })}
            onClose={() => setModal({ type: "none" })}
            onToggle={() => start(() => toggleReminderDone(modal.reminder.id, !modal.reminder.done))}
            onDelete={() => start(async () => { await deleteReminder(modal.reminder.id); setModal({ type: "none" }); })}
          />
        </Overlay>
      )}
    </div>
  );
}

function toFormValues(r: CalReminder) {
  const d = new Date(r.date);
  return {
    title: r.title,
    description: r.description,
    date: isoLocal(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    isPublic: r.isPublic,
    color: r.color,
    action: r.action,
    contactId: null,
    messageBody: r.messageBody,
  };
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative z-10 my-8 w-full max-w-md animate-in rounded-2xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="بستن" className="rounded-lg p-1 text-muted hover:bg-gray-50">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function DetailBody({
  r,
  onEdit,
  onToggle,
  onDelete,
}: {
  r: CalReminder;
  onEdit: () => void;
  onClose: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const phone = r.contactPhone ? toEn(r.contactPhone) : null;
  const waText = r.messageBody ? `?text=${encodeURIComponent(r.messageBody)}` : "";
  const smsBody = r.messageBody ? `?body=${encodeURIComponent(r.messageBody)}` : "";

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-muted">
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: `${r.color}22`, color: r.color }}>
          {ACTION_LABEL[r.action]}
        </span>
        <span>{formatTime(r.date)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          {r.isPublic ? <Globe size={13} /> : <Lock size={13} />}
          {r.isPublic ? "تیمی" : "شخصی"}
        </span>
        <span>·</span>
        <span>{r.ownerName}</span>
      </div>

      {r.contactName && (
        <div>
          مخاطب: <span className="font-medium">{r.contactName}</span>
          {phone && <span className="ms-2 text-muted" dir="ltr">{toFa(phone)}</span>}
        </div>
      )}
      {r.description && <p className="rounded-lg bg-gray-50 p-3 text-muted">{r.description}</p>}
      {r.messageBody && (
        <div className="rounded-lg border border-border p-3">
          <span className="text-xs text-muted">متن پیام:</span>
          <p className="mt-1">{r.messageBody}</p>
        </div>
      )}

      {/* Outreach actions */}
      {phone && r.action !== "GENERAL" && (
        <div className="flex flex-wrap gap-2">
          {r.action === "CALL" && (
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-white">
              <Phone size={15} /> تماس
            </a>
          )}
          {r.action === "WHATSAPP" && (
            <a href={`https://wa.me/${toWhatsappNumber(phone)}${waText}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-white">
              <MessageCircle size={15} /> ارسال واتساپ
            </a>
          )}
          {r.action === "SMS" && (
            <a href={`sms:${phone}${smsBody}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-white">
              <Send size={15} /> ارسال پیامک
            </a>
          )}
        </div>
      )}

      {r.canEdit && (
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <button onClick={onToggle} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50">
            <Check size={15} /> {r.done ? "انجام‌نشده" : "انجام شد"}
          </button>
          <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-gray-50">
            <Pencil size={15} /> ویرایش
          </button>
          <button onClick={onDelete} className="ms-auto inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
            <Trash2 size={15} /> حذف
          </button>
        </div>
      )}
    </div>
  );
}
