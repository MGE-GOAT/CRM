import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers, isOwner } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { SelectFilter } from "@/components/select-filter";
import { TaskForm } from "./task-form";
import { TaskItem } from "./task-item";
import { createTask } from "@/lib/actions/tasks";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import { formatNumber } from "@/lib/format";

/** Editorial section head: ink baseline, quiet-confident title, count chip. */
function SectionHead({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3">
      <h2 className="text-sm font-bold tracking-tight text-text">{label}</h2>
      {accent ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-tint)] px-2 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-mid)]" aria-hidden="true" />
          {formatNumber(count)}
        </span>
      ) : (
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium text-muted">
          {formatNumber(count)}
        </span>
      )}
    </div>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const user = await requireUser();
  const owner = isOwner(user.role);
  const { user: filterUserId } = await searchParams;

  // Privacy: only the OWNER sees everyone's tasks (and may filter by user);
  // everyone else sees only the tasks assigned to them.
  const where = owner
    ? filterUserId
      ? { assigneeId: filterUserId }
      : {}
    : { assigneeId: user.id };

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
      include: {
        assignee: { select: { name: true, avatarColor: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const render = (t: (typeof tasks)[number]) => (
    <TaskItem
      key={t.id}
      id={t.id}
      title={t.title}
      description={t.description}
      completed={t.completed}
      priority={t.priority}
      dueDate={t.dueDate}
      assigneeName={t.assignee.name}
      assigneeColor={t.assignee.avatarColor}
      canDelete={canManageUsers(user.role)}
    />
  );

  return (
    <div>
      <AutoRefresh interval={20000} />
      <PageHeader
        title="وظایف"
        subtitle={`${formatNumber(open.length)} باز · ${formatNumber(done.length)} انجام‌شده`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {owner && (
              <SelectFilter
                param="user"
                allLabel="همهٔ کاربران"
                options={users.map((u) => ({ value: u.id, label: u.name }))}
              />
            )}
            <TaskForm
              action={createTask}
              users={owner ? users : [{ id: user.id, name: user.name }]}
              currentUserId={user.id}
            />
          </div>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <SectionHead label="باز" count={open.length} accent />
          <div className="divide-y divide-border">
            {open.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                وظیفه بازی وجود ندارد. 🎉
              </p>
            ) : (
              open.map(render)
            )}
          </div>
        </div>

        {done.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
            <SectionHead label="انجام‌شده" count={done.length} />
            <div className="divide-y divide-border">{done.map(render)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
