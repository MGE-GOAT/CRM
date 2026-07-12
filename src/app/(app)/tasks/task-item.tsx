"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatDate, formatTime } from "@/lib/format";
import { toggleTask, deleteTask } from "@/lib/actions/tasks";

export function TaskItem({
  id,
  title,
  description,
  completed,
  priority,
  dueDate,
  assigneeName,
  assigneeColor,
  canDelete,
}: {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: string;
  dueDate: Date | null;
  assigneeName: string;
  assigneeColor: string;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const overdue = dueDate && !completed && new Date(dueDate) < new Date();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--gold-tint)] ${
        completed ? "opacity-70" : ""
      }`}
    >
      {/* completion toggle */}
      <button
        onClick={() => start(() => toggleTask(id, !completed))}
        disabled={pending}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
          completed
            ? "border-[color:var(--gold-ink)] bg-[color:var(--gold-ink)] text-white"
            : "border-border-strong hover:border-[color:var(--gold-ink)]"
        }`}
        aria-label={completed ? "علامت‌گذاری به‌عنوان انجام‌نشده" : "علامت‌گذاری به‌عنوان انجام‌شده"}
      >
        {completed && <Check size={13} />}
      </button>

      {/* 1) OWNER (assignee) */}
      <div className="flex shrink-0 items-center gap-2" title={assigneeName}>
        <Avatar name={assigneeName} color={assigneeColor} size={26} />
        <span className="hidden max-w-[7rem] truncate text-xs font-medium text-muted sm:inline">
          {assigneeName}
        </span>
      </div>

      {/* 2) EXPLANATION (title + description) */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${completed ? "text-muted line-through" : "text-text"}`}>
          {title}
        </p>
        {description && <p className="truncate text-xs text-muted">{description}</p>}
        {/* deadline echoed under the title on mobile (the side column is hidden below sm) */}
        <p className={`text-xs sm:hidden ${overdue ? "font-medium text-red-600" : "text-muted"}`}>
          {dueDate ? `${formatDate(dueDate)} · ${formatTime(dueDate)}` : "بدون مهلت"}
        </p>
      </div>

      {/* 3) DEADLINE / TIME */}
      <span
        className={`hidden w-28 shrink-0 text-end text-xs leading-tight sm:block ${
          overdue ? "font-medium text-red-600" : "text-muted"
        }`}
      >
        {dueDate ? (
          <>
            {formatDate(dueDate)}
            <span className="block text-[11px] text-faint">{formatTime(dueDate)}</span>
          </>
        ) : (
          "بدون مهلت"
        )}
      </span>

      {/* 4) PRIORITY */}
      <PriorityBadge priority={priority} />

      {canDelete && <ConfirmDelete onDelete={deleteTask.bind(null, id)} iconOnly />}
    </div>
  );
}
