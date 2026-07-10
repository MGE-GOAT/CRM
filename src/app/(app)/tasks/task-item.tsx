"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatDate } from "@/lib/format";
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
  related,
}: {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: string;
  dueDate: Date | null;
  assigneeName: string;
  assigneeColor: string;
  related: string | null;
}) {
  const [pending, start] = useTransition();
  const overdue = dueDate && !completed && new Date(dueDate) < new Date();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--gold-tint)] ${
        completed ? "opacity-70" : ""
      }`}
    >
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

      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${
            completed ? "text-muted line-through" : "text-text"
          }`}
        >
          {title}
        </p>
        {description && (
          <p className="truncate text-xs text-muted">{description}</p>
        )}
        {related && (
          <p className="text-xs text-[color:var(--gold-ink)]">{related}</p>
        )}
        {/* Due date shown here on mobile (the side column is hidden below sm). */}
        <p className={`text-xs sm:hidden ${overdue ? "font-medium text-red-600" : "text-muted"}`}>
          {dueDate ? formatDate(dueDate) : "بدون مهلت"}
        </p>
      </div>

      <PriorityBadge priority={priority} />

      <span
        className={`hidden w-28 text-end text-xs sm:block ${
          overdue ? "font-medium text-red-600" : "text-muted"
        }`}
      >
        {dueDate ? formatDate(dueDate) : "بدون مهلت"}
      </span>

      <Avatar name={assigneeName} color={assigneeColor} size={26} />

      <ConfirmDelete onDelete={deleteTask.bind(null, id)} iconOnly />
    </div>
  );
}
