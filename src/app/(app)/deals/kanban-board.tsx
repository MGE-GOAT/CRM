"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatRial, formatPercent, formatNumber } from "@/lib/format";
import { stageLabel } from "@/lib/labels";
import { DealForm, type DealValues } from "./deal-form";

type Option = { id: string; name: string };

export type DealCard = {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  companyName: string | null;
  contactName: string | null;
  ownerName: string;
  ownerColor: string;
  editValues: DealValues;
};

// Stage dot colors mirror the StageBadge palette so a LEAD dot on the board
// reads as the same stage the badge shows elsewhere.
const COLUMNS = [
  { key: "LEAD", label: stageLabel.LEAD, color: "#4b5563" },
  { key: "QUALIFIED", label: stageLabel.QUALIFIED, color: "#0369a1" },
  { key: "PROPOSAL", label: stageLabel.PROPOSAL, color: "#92600a" },
  { key: "NEGOTIATION", label: stageLabel.NEGOTIATION, color: "#6d28d9" },
  { key: "WON", label: stageLabel.WON, color: "#047857" },
  { key: "LOST", label: stageLabel.LOST, color: "#b91c1c" },
];

export function KanbanBoard({
  initialDeals,
  companies,
  contacts,
  moveDeal,
  updateDeal,
  deleteDeal,
  canDelete,
}: {
  initialDeals: DealCard[];
  companies: Option[];
  contacts: Option[];
  moveDeal: (id: string, stage: string) => Promise<{ error?: string } | void>;
  updateDeal: (id: string, formData: FormData) => Promise<{ error?: string } | void>;
  deleteDeal: (id: string) => Promise<{ error?: string } | void>;
  canDelete: boolean;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Resync when the server streams fresh data after an edit/delete
  // (revalidatePath('/deals')) — otherwise the board keeps stale cards.
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  function move(id: string, stage: string) {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    const prevStage = deal.stage;
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    startTransition(async () => {
      const res = await moveDeal(id, stage);
      // Roll back the optimistic move if the server rejected it (e.g. not owner).
      if (res?.error) {
        setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage: prevStage } : d)));
      }
    });
  }

  function onDrop(stage: string) {
    setOverCol(null);
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    move(id, stage);
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto p-4 sm:p-6">
      {COLUMNS.map((col) => {
        const colDeals = deals.filter((d) => d.stage === col.key);
        const total = colDeals.reduce((s, d) => s + d.value, 0);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOverCol(col.key);
            }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => onDrop(col.key)}
            className={`flex w-[82vw] max-w-xs shrink-0 flex-col rounded-2xl border bg-surface-2/50 transition-colors sm:w-72 ${
              overCol === col.key
                ? "border-[var(--gold-mid)] bg-[var(--gold-tint)]"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-bold tracking-tight">{col.label}</span>
                <span className="rounded-full bg-surface-3 px-1.5 py-0.5 text-[11px] font-medium text-muted">
                  {formatNumber(colDeals.length)}
                </span>
              </div>
              <span className="shrink-0 text-xs font-medium text-muted">
                {formatRial(total)}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-2 py-2.5">
              {colDeals.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`group cursor-grab rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow-sm)] transition hover:bg-[var(--gold-tint)] hover:shadow-[var(--shadow-md)] active:cursor-grabbing ${
                    dragId === d.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <Link
                      href={`/deals/${d.id}`}
                      className="text-sm font-medium leading-snug hover:text-[color:var(--gold-ink)]"
                    >
                      {d.title}
                    </Link>
                    <div className="flex items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <DealForm
                        mode="edit"
                        action={updateDeal.bind(null, d.id)}
                        companies={companies}
                        contacts={contacts}
                        values={d.editValues}
                      />
                      {canDelete && <ConfirmDelete onDelete={deleteDeal.bind(null, d.id)} iconOnly />}
                    </div>
                  </div>
                  {(d.companyName || d.contactName) && (
                    <p className="mt-1 text-xs text-muted">
                      {[d.companyName, d.contactName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[color:var(--gold-ink)]">
                      {formatRial(d.value)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">{formatPercent(d.probability)}</span>
                      <Avatar name={d.ownerName} color={d.ownerColor} size={22} />
                    </div>
                  </div>
                  {/* Keyboard-accessible alternative to drag-and-drop */}
                  <label className="sr-only" htmlFor={`stage-${d.id}`}>
                    تغییر مرحلهٔ معامله
                  </label>
                  <select
                    id={`stage-${d.id}`}
                    value={d.stage}
                    onChange={(e) => move(d.id, e.target.value)}
                    className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted opacity-100 transition sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {colDeals.length === 0 && (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-8 text-xs text-muted">
                  <GripVertical size={14} aria-hidden="true" className="me-1" /> معامله‌ای را اینجا رها کنید
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
