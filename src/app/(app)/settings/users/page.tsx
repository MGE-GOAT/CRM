import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { isOwner } from "@/lib/rbac";
import { UserForm } from "./user-form";
import { RoleSelect, ActiveToggle, ResetPasswordButton } from "./user-row-actions";
import { JoinRequests, type JoinRequest } from "./join-requests";
import { roleLabel } from "@/lib/labels";

export default async function UsersPage() {
  const current = await requireRole("OWNER", "ADMIN");
  const owner = isOwner(current.role);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { deals: true, contacts: true, assignedTasks: true } },
    },
  });

  // Members waiting for the owner to approve their login.
  const pending = owner
    ? await prisma.user.findMany({
        where: { role: "MEMBER", isActive: true, pendingSince: { not: null } },
        select: { id: true, name: true, email: true, role: true, pendingSince: true },
        orderBy: { pendingSince: "asc" },
      })
    : [];
  const joinRequests: JoinRequest[] = pending.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: roleLabel[u.role] ?? u.role,
    requestedAt: u.pendingSince ? formatDateTime(u.pendingSince) : "—",
  }));

  return (
    <div>
      <PageHeader
        title="تیم و تنظیمات"
        subtitle="مدیریت دسترسی کاربران به سامانه"
        action={<UserForm />}
      />

      <div className="p-4 sm:p-6">
        {owner && <JoinRequests requests={joinRequests} />}
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-[color:var(--rule)] bg-surface-2 text-right text-xs tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">عضو</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">تاریخ عضویت</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">فعالیت‌ها</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const isSelf = u.id === current.id;
                return (
                  <tr key={u.id} className="hover:bg-[var(--gold-tint)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} color={u.avatarColor} size={34} />
                        <div>
                          <div className="font-medium">
                            {u.name}
                            {isSelf && (
                              <span className="ms-2 text-xs text-muted">(شما)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted" dir="ltr">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3 text-muted lg:table-cell">
                      {formatNumber(u._count.deals)} معامله ·{" "}
                      {formatNumber(u._count.contacts)} مخاطب ·{" "}
                      {formatNumber(u._count.assignedTasks)} وظیفه
                    </td>
                    <td className="px-4 py-3">
                      <RoleSelect userId={u.id} role={u.role} disabled={isSelf} />
                    </td>
                    <td className="px-4 py-3">
                      <ActiveToggle
                        userId={u.id}
                        isActive={u.isActive}
                        disabled={isSelf}
                      />
                    </td>
                    <td className="px-4 py-3 text-start">
                      <ResetPasswordButton userId={u.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          شما نمی‌توانید نقش خود را تغییر دهید یا حساب خود را غیرفعال کنید.
        </p>
      </div>
    </div>
  );
}
