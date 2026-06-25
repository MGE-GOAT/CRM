"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  TrendingUp,
  CheckSquare,
  MessageSquare,
  CalendarDays,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/", label: "داشبورد", icon: LayoutDashboard },
  { href: "/contacts", label: "مخاطبین", icon: Users },
  { href: "/companies", label: "شرکت‌ها", icon: Building2 },
  { href: "/deals", label: "معاملات", icon: TrendingUp },
  { href: "/tasks", label: "وظایف", icon: CheckSquare },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/chat", label: "گفتگوی تیمی", icon: MessageSquare },
];

export function Sidebar({ canManageUsers }: { canManageUsers: boolean }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar-bg text-sidebar-text">
      <div className="flex h-16 items-center px-5">
        <Logo width={140} />
      </div>
      <nav aria-label="منوی اصلی" className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={isActive(href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive(href)
                ? "bg-sidebar-surface text-[var(--gold-from)]"
                : "text-sidebar-text/80 hover:bg-sidebar-surface/60 hover:text-white"
            )}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>
      {canManageUsers && (
        <div className="border-t border-white/10 px-3 py-2">
          <Link
            href="/settings/users"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              pathname.startsWith("/settings")
                ? "bg-sidebar-surface text-[var(--gold-from)]"
                : "text-sidebar-text/80 hover:bg-sidebar-surface/60 hover:text-white"
            )}
          >
            <Settings size={18} />
            تیم و تنظیمات
          </Link>
        </div>
      )}
    </aside>
  );
}
