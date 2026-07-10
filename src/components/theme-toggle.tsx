"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Optional warm "Vault" dark theme toggle. Light is the default (brand site
 *  is light); the choice persists in localStorage and is applied to <html>. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    setDark(!dark);
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "روشن کردن پوسته" : "تیره کردن پوسته"}
      title={dark ? "پوستهٔ روشن" : "پوستهٔ تیره"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-muted transition hover:bg-sidebar-surface hover:text-sidebar-text"
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
