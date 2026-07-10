"use client";

import { useState, useRef, useEffect } from "react";
import { LogOut, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { logout } from "@/lib/actions/auth-actions";
import { roleLabel } from "@/lib/labels";

export function UserMenu({
  name,
  email,
  role,
  color,
}: {
  name: string;
  email: string;
  role: string;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — منوی کاربر`}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--gold-tint)]"
      >
        <Avatar name={name} color={color} />
        <div className="hidden text-right sm:block">
          <div className="text-sm font-medium leading-tight">{name}</div>
          <div className="text-xs text-muted">{roleLabel[role] ?? role}</div>
        </div>
        <ChevronDown size={16} className="text-muted" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute end-0 z-20 mt-2 w-56 animate-in rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-lg)]">
          <div className="px-3 py-2">
            <div className="text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted">{email}</div>
          </div>
          <div className="my-1 h-px bg-border" />
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut size={16} />
              خروج
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
