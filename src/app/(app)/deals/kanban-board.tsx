"use client";

import { useState, useTransition } from "react";
import { GripVertical } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatToman, formatPercent, formatNumber } from "@/lib/format";
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

const COLUMNS = [
  { key: "LEAD", label: stageLabel.LEAD, color: "#9aa0a6" },
  { key: "QUALIFIED", label: stageLabel.QUALIFIED, color: "#0ea5e9" },
  { key: "PROPOSAL", label: stageLabel.PROPOSAL, color: "#d4af37" },
  { key: "NEGOTIATION", label: stageLabel.NEGOTIATION, color: "#8b5cf6" },
  { key: "WON", label: stageLabel.WON, color: "#10b981" },
  { key: "LOST", label: stageLabel.LOST, color: "#ef4444" },
];

export function KanbanBoard({
  initialDeals,
  companies,
  contacts,
  moveDeal,
  updateDeal,
  deleteDeal,
}: {
  initialDeals: DealCard[];
  companies: Option[];
  contacts: Option[];
  moveDeal: (id: string, stage: string) => Promise<void>;
  updateDeal: (id: string, formData: FormData) => Promise<{ error?: string } | void>;
  deleteDeal: (id: string) => Promise<void>;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(id: string, stage: string) {
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === stage) return;
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, stage } : d)));
    startTransition(() => {
      moveDeal(id, stage);
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
    <div className="flex gap-4 overflow-x-auto p-4 sm:p-6">
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
            className={`flex w-[82vw] max-w-xs shrink-0 flex-col rounded-xl border bg-gray-50/60 transition sm:w-72 ${
              overCol === col.key
                ? "border-[var(--brand)] bg-brand-50"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between px-3 py-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="text-sm font-semibold">{col.label}</span>
                <span className="rounded-full bg-gray-200 px-1.5 text-xs text-gray-600">
                  {formatNumber(colDeals.length)}
                </span>
              </div>
              <span className="text-xs text-muted">
                {formatToman(total)}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
              {colDeals.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={() => setDragId(d.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`group cursor-grab rounded-lg border border-border bg-surface p-3 shadow-sm transition active:cursor-grabbing ${
                    dragId === d.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium leading-snug">{d.title}</p>
                    <div className="flex items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <DealForm
                        mode="edit"
                        action={updateDeal.bind(null, d.id)}
                        companies={companies}
                        contacts={contacts}
                        values={d.editValues}
                      />
                      <ConfirmDelete onDelete={deleteDeal.bind(null, d.id)} iconOnly />
                    </div>
                  </div>
                  {(d.companyName || d.contactName) && (
                    <p className="mt-1 text-xs text-muted">
                      {[d.companyName, d.contactName].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--brand)]">
                      {formatToman(d.value)}
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
                    className="mt-2 w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted opacity-0 transition focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
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
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border py-8 text-xs text-muted">
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
