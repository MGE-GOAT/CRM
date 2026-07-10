"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";

const NAV = [
  { href: "/", label: "داشبورد" },
  { href: "/contacts", label: "مخاطبین" },
  { href: "/companies", label: "شرکت‌ها" },
  { href: "/deals", label: "معاملات" },
  { href: "/reports", label: "گزارش‌ها" },
  { href: "/tasks", label: "وظایف" },
  { href: "/calendar", label: "تقویم" },
  { href: "/chat", label: "گفتگوی تیمی" },
];

export function MobileNav({ canManageUsers }: { canManageUsers: boolean }) {
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const base = NAV.filter((n) => n.href !== "/reports" || canManageUsers);
  const items = canManageUsers
    ? [...base, { href: "/settings/users", label: "تیم و تنظیمات" }]
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
        className="rounded-lg p-2 hover:bg-[var(--gold-tint)]"
        aria-label="باز کردن منو"
      >
        <Menu size={20} aria-hidden="true" />
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
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(item.href)
                      ? "bg-sidebar-surface text-[var(--gold-from)]"
                      : "text-sidebar-text/80 hover:bg-sidebar-surface/60"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
