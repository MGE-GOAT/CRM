import { requireUser } from "@/lib/rbac";
import { canManageUsers } from "@/lib/rbac";
import { Sidebar } from "@/components/sidebar";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const showAdmin = canManageUsers(user.role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar canManageUsers={showAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
          <MobileNav canManageUsers={showAdmin} />
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <NotificationBell />
            <UserMenu
              name={user.name}
              email={user.email}
              role={user.role}
              color={user.avatarColor}
            />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
