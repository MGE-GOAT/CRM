import { prisma } from "@/lib/prisma";
import { requireUser, canManageUsers } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { CalendarView, type CalReminder } from "./calendar-view";

export default async function CalendarPage() {
  const user = await requireUser();
  const manage = canManageUsers(user.role);

  const [reminders, contacts] = await Promise.all([
    prisma.reminder.findMany({
      where: { OR: [{ isPublic: true }, { createdById: user.id }] },
      orderBy: { date: "asc" },
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.contact.findMany({
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } },
    }),
  ]);

  const calReminders: CalReminder[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    date: r.date.toISOString(),
    isPublic: r.isPublic,
    color: r.color,
    done: r.done,
    action: r.action,
    messageBody: r.messageBody,
    contactName: r.contact ? `${r.contact.firstName} ${r.contact.lastName}` : null,
    contactPhone: r.contact?.phone ?? null,
    ownerName: r.createdBy.name,
    canEdit: r.createdById === user.id || manage,
  }));

  const contactOptions = contacts.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}${c.company ? ` — ${c.company.name}` : ""}`,
  }));

  return (
    <div>
      <PageHeader title="تقویم" subtitle="برنامه‌های تماس و پیام تیم و یادآوری‌های شخصی" />
      <CalendarView reminders={calReminders} contacts={contactOptions} canDelete={manage} />
    </div>
  );
}
