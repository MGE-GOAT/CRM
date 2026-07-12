"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { StateBadge } from "@/components/ui/factor-badge";
import { STATE_LABEL, PAYMENT_KIND_LABEL } from "@/lib/factor";
import { formatNumber, toFa } from "@/lib/format";
import type { FactorState, PaymentKind } from "@prisma/client";

export type FactorLite = {
  id: string;
  number: number;
  state: FactorState;
  paymentKind: PaymentKind;
  isPre: boolean;
  buyerName: string;
  payable: number;
  dayKey: string; // Tehran YYYY-MM-DD, for grouping + sorting
  dayLabel: string; // Jalali label, e.g. ۲۱ تیر ۱۴۰۵
  creatorId: string;
};

export type SalesPerson = { id: string; name: string; avatarColor: string };

const STATE_ORDER: FactorState[] = [
  "INITIAL",
  "FOLLOWING_UP",
  "PAID",
  "SENDING",
  "EXIT",
  "CANCELED",
];
const PAYMENT_ORDER: PaymentKind[] = ["CASH", "CHEQUE", "HALF_HALF"];

/** Count factors per state, in canonical order (only non-zero shown). */
function recap(list: FactorLite[]): { state: FactorState; count: number }[] {
  const counts = new Map<FactorState, number>();
  for (const f of list) counts.set(f.state, (counts.get(f.state) ?? 0) + 1);
  return STATE_ORDER.filter((s) => counts.has(s)).map((s) => ({ state: s, count: counts.get(s)! }));
}

function RecapChips({ list }: { list: FactorLite[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {recap(list).map(({ state, count }) => (
        <span key={state} className="inline-flex items-center gap-1">
          <StateBadge state={state} />
          <span className="tabular-nums text-xs font-bold text-muted">{toFa(count)}</span>
        </span>
      ))}
      <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted">
        {toFa(list.length)} فاکتور
      </span>
    </div>
  );
}

export function FactorsBrowser({
  factors,
  salespeople,
}: {
  factors: FactorLite[];
  salespeople: SalesPerson[];
}) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<FactorState | "">("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentKind | "">("");
  const [personFilter, setPersonFilter] = useState<string>("");
  const [openPeople, setOpenPeople] = useState<Set<string>>(new Set());
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());

  const nameById = useMemo(
    () => new Map(salespeople.map((s) => [s.id, s] as const)),
    [salespeople],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return factors.filter((f) => {
      if (stateFilter && f.state !== stateFilter) return false;
      if (paymentFilter && f.paymentKind !== paymentFilter) return false;
      if (personFilter && f.creatorId !== personFilter) return false;
      if (q) {
        const hay = `${f.buyerName} ${f.number} ${f.dayLabel} ${
          STATE_LABEL[f.state]
        } ${PAYMENT_KIND_LABEL[f.paymentKind]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [factors, query, stateFilter, paymentFilter, personFilter]);

  // Group filtered → person → day.
  const people = useMemo(() => {
    const byPerson = new Map<string, FactorLite[]>();
    for (const f of filtered) {
      const list = byPerson.get(f.creatorId);
      if (list) list.push(f);
      else byPerson.set(f.creatorId, [f]);
    }
    return salespeople
      .filter((s) => byPerson.has(s.id))
      .map((s) => {
        const list = byPerson.get(s.id)!;
        const byDay = new Map<string, FactorLite[]>();
        for (const f of list) {
          const d = byDay.get(f.dayKey);
          if (d) d.push(f);
          else byDay.set(f.dayKey, [f]);
        }
        const days = [...byDay.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest day first
          .map(([dayKey, items]) => ({ dayKey, label: items[0].dayLabel, items }));
        return { person: s, list, days };
      });
  }, [filtered, salespeople]);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const hasActiveFilter = query || stateFilter || paymentFilter || personFilter;

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-3 shadow-[var(--shadow-sm)] sm:p-4">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجو: نام خریدار، شماره فاکتور، تاریخ…"
            className="w-full rounded-lg border border-border bg-surface-2 py-2 pe-9 ps-3 text-sm outline-none focus:border-[var(--gold-mid)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={!stateFilter} onClick={() => setStateFilter("")}>
            همه وضعیت‌ها
          </FilterChip>
          {STATE_ORDER.map((s) => (
            <FilterChip key={s} active={stateFilter === s} onClick={() => setStateFilter(s)}>
              {STATE_LABEL[s]}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={!paymentFilter} onClick={() => setPaymentFilter("")}>
            همه پرداخت‌ها
          </FilterChip>
          {PAYMENT_ORDER.map((k) => (
            <FilterChip key={k} active={paymentFilter === k} onClick={() => setPaymentFilter(k)}>
              {PAYMENT_KIND_LABEL[k]}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-[var(--gold-mid)]"
          >
            <option value="">همهٔ فروشندگان</option>
            {salespeople.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStateFilter("");
                setPaymentFilter("");
                setPersonFilter("");
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs text-muted hover:bg-surface-2"
            >
              <X size={13} aria-hidden="true" /> پاک کردن فیلترها
            </button>
          )}
          <span className="ms-auto text-xs text-muted">
            {toFa(filtered.length)} از {toFa(factors.length)} فاکتور
          </span>
        </div>
      </div>

      {/* Overall recap of the current filter result */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface-2 px-4 py-3">
          <RecapChips list={filtered} />
        </div>
      )}

      {/* Person → date → factor drill-down */}
      {people.length === 0 ? (
        <p className="px-4 py-16 text-center text-sm text-muted">
          {hasActiveFilter ? "فاکتوری با این فیلترها پیدا نشد." : "هنوز فاکتوری ثبت نشده است."}
        </p>
      ) : (
        people.map(({ person, list, days }) => {
          const personOpen = openPeople.has(person.id);
          return (
            <section
              key={person.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]"
            >
              <button
                type="button"
                onClick={() => toggle(openPeople, person.id, setOpenPeople)}
                className="flex w-full flex-col gap-2 border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3 text-start transition-colors hover:bg-surface-3"
                aria-expanded={personOpen}
              >
                <RecapChips list={list} />
                <div className="flex items-center gap-2">
                  <ChevronLeft
                    size={18}
                    className={`text-faint transition-transform ${personOpen ? "-rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                  <Avatar name={person.name} color={person.avatarColor} size={28} />
                  <h2 className="font-bold tracking-tight text-text">{person.name}</h2>
                </div>
              </button>

              {personOpen && (
                <div className="divide-y divide-border">
                  {days.map(({ dayKey, label, items }) => {
                    const dateId = `${person.id}:${dayKey}`;
                    const dateOpen = openDates.has(dateId);
                    return (
                      <div key={dateId}>
                        <button
                          type="button"
                          onClick={() => toggle(openDates, dateId, setOpenDates)}
                          className="flex w-full flex-col gap-2 px-4 py-3 text-start transition-colors hover:bg-surface-2"
                          aria-expanded={dateOpen}
                        >
                          <div className="flex items-center gap-2">
                            <ChevronLeft
                              size={16}
                              className={`text-faint transition-transform ${
                                dateOpen ? "-rotate-90" : ""
                              }`}
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium tabular-nums">{label}</span>
                          </div>
                          <div className="ps-6">
                            <RecapChips list={items} />
                          </div>
                        </button>

                        {dateOpen && (
                          <div className="divide-y divide-border border-t border-border bg-surface-2/40">
                            {items.map((f) => (
                              <Link
                                key={f.id}
                                href={`/factors/${f.id}`}
                                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 ps-10 text-sm transition-colors hover:bg-surface-2"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="font-medium tabular-nums">
                                    {f.isPre ? "پیش‌فاکتور" : "فاکتور"} #{toFa(f.number)}
                                  </span>
                                  <span className="text-muted">{f.buyerName}</span>
                                </span>
                                <span className="flex items-center gap-3 text-muted">
                                  <span>{PAYMENT_KIND_LABEL[f.paymentKind]}</span>
                                  <StateBadge state={f.state} />
                                  <span className="font-medium tabular-nums text-text">
                                    {formatNumber(f.payable)} ریال
                                  </span>
                                </span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--gold-mid)] bg-[var(--gold-tint)] text-[color:var(--gold-ink)]"
          : "border-border bg-surface text-muted hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
