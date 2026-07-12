"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Building2,
  CheckSquare,
  MessageSquare,
  CalendarDays,
  BarChart3,
  FileText,
  Send,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "گزارش‌ها", icon: BarChart3 },
  { href: "/contacts", label: "مخاطبین", icon: Users },
  { href: "/companies", label: "شرکت‌ها", icon: Building2 },
  { href: "/factors", label: "فاکتورها", icon: FileText },
  { href: "/tasks", label: "وظایف", icon: CheckSquare },
  { href: "/calendar", label: "تقویم", icon: CalendarDays },
  { href: "/chat", label: "گفتگوی تیمی", icon: MessageSquare },
];

function NavRow({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: typeof Users;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-sidebar-surface text-[var(--gold-from)]"
          : "text-sidebar-text/80 hover:bg-sidebar-surface/60 hover:text-white"
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 start-0 w-[3px] rounded-e-full bg-gradient-to-b from-[var(--gold-from)] to-[var(--gold-to)]"
        />
      )}
      <Icon size={18} aria-hidden="true" />
      {label}
    </Link>
  );
}

export function Sidebar({ canManageUsers }: { canManageUsers: boolean }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-sidebar-bg text-sidebar-text md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo width={140} />
      </div>
      <nav aria-label="منوی اصلی" className="flex-1 space-y-1 px-3 py-2">
        {NAV.map(({ href, label, icon }) => (
          <NavRow key={href} href={href} label={label} Icon={icon} active={isActive(href)} />
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 py-2">
        {canManageUsers && (
          <NavRow
            href="/factors/sent"
            label="ارسالی‌ها"
            Icon={Send}
            active={pathname.startsWith("/factors/sent")}
          />
        )}
        {canManageUsers && (
          <NavRow
            href="/settings/users"
            label="تیم و تنظیمات"
            Icon={Settings}
            active={pathname.startsWith("/settings")}
          />
        )}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-xs text-sidebar-muted">پوستهٔ نمایش</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
