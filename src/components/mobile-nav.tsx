"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toFa } from "@/lib/format";
import { Logo } from "@/components/logo";
import { useNotifications, navKeyFor } from "@/components/notifications/notifications-provider";

const NAV = [
  { href: "/", label: "داشبورد" },
  { href: "/contacts", label: "مخاطبین" },
  { href: "/companies", label: "شرکت‌ها" },
  { href: "/factors", label: "فاکتورها" },
  { href: "/reports", label: "گزارش‌ها" },
  { href: "/tasks", label: "وظایف" },
  { href: "/calendar", label: "تقویم" },
  { href: "/chat", label: "گفتگوی تیمی" },
];

export function MobileNav({ canManageUsers }: { canManageUsers: boolean }) {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { sectionCount, activeCount } = useNotifications();
  const base = NAV.filter((n) => n.href !== "/reports" || canManageUsers);
  const items = canManageUsers
    ? [
        ...base,
        { href: "/factors/sent", label: "ارسالی‌ها" },
        { href: "/settings/users", label: "تیم و تنظیمات" },
      ]
    : base;
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus(); // move focus into the dialog on open
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-lg p-2 hover:bg-[var(--gold-tint)]"
        aria-label={activeCount > 0 ? `باز کردن منو، ${activeCount} اعلان دیده‌نشده` : "باز کردن منو"}
      >
        <Menu size={20} aria-hidden="true" />
        {activeCount > 0 && (
          <span className="absolute end-1 top-1 flex min-w-3.5 items-center justify-center rounded-full bg-[var(--gold-to)] px-1 text-[9px] font-bold leading-[14px] text-[#241a05]">
            {activeCount > 9 ? "+۹" : toFa(String(activeCount))}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="منوی ناوبری"
            className="relative z-10 w-64 max-w-[80vw] bg-sidebar-bg p-4 text-sidebar-text"
          >
            <div className="mb-4 flex items-center justify-between">
              <Logo width={120} />
              <button ref={closeBtnRef} onClick={() => setOpen(false)} aria-label="بستن منو">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="منوی موبایل" className="space-y-1">
              {items.map((item) => {
                const count = sectionCount(navKeyFor(item.href) ?? "");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                      isActive(item.href)
                        ? "bg-sidebar-surface text-[var(--gold-from)]"
                        : "text-sidebar-text/80 hover:bg-sidebar-surface/60 hover:text-white"
                    )}
                  >
                    {isActive(item.href) && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 start-0 w-[3px] rounded-e-full bg-gradient-to-b from-[var(--gold-from)] to-[var(--gold-to)]"
                      />
                    )}
                    {item.label}
                    {count > 0 && (
                      <span
                        aria-label={`${count} اعلان دیده‌نشده`}
                        className="ms-auto flex min-w-5 items-center justify-center rounded-full bg-[var(--gold-to)] px-1.5 text-[11px] font-bold leading-5 text-[#241a05]"
                      >
                        {toFa(count > 99 ? "+۹۹" : String(count))}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
