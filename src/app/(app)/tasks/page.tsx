import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "./task-form";
import { TaskItem } from "./task-item";
import { createTask } from "@/lib/actions/tasks";
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

export default async function TasksPage() {
  const user = await requireUser();

  const [tasks, users, deals, contacts] = await Promise.all([
    prisma.task.findMany({
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }],
      include: {
        assignee: { select: { name: true, avatarColor: true } },
        deal: { select: { title: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.deal.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const dealOptions = deals.map((d) => ({ id: d.id, name: d.title }));
  const contactOptions = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
  }));

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
      related={
        t.deal?.title ??
        (t.contact ? `${t.contact.firstName} ${t.contact.lastName}` : null)
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="وظایف"
        subtitle={`${formatNumber(open.length)} باز · ${formatNumber(done.length)} انجام‌شده`}
        action={
          <TaskForm
            action={createTask}
            users={users}
            deals={dealOptions}
            contacts={contactOptions}
            currentUserId={user.id}
          />
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
