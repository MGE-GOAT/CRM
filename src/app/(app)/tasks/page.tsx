import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { TaskForm } from "./task-form";
import { TaskItem } from "./task-item";
import { createTask } from "@/lib/actions/tasks";
import { formatNumber } from "@/lib/format";

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
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-border bg-gray-50 px-4 py-2.5 text-xs font-medium tracking-wide text-muted">
            باز ({formatNumber(open.length)})
          </div>
          <div className="divide-y divide-border">
            {open.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                وظیفه بازی وجود ندارد. 🎉
              </p>
            ) : (
              open.map(render)
            )}
          </div>
        </div>

        {done.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border bg-gray-50 px-4 py-2.5 text-xs font-medium tracking-wide text-muted">
              انجام‌شده ({formatNumber(done.length)})
            </div>
            <div className="divide-y divide-border">{done.map(render)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
