"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Responsive chat layout:
 * - Desktop: channel list + thread side by side.
 * - Mobile: show the channel list on /chat, and the thread (full width) when a
 *   channel is open (/chat/[id]). The thread header has a "back" link.
 */
export function ChatShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const onIndex = path === "/chat";

  return (
    <div className="flex h-full overflow-hidden">
      <div className={cn("h-full shrink-0", onIndex ? "block w-full md:w-60" : "hidden md:block md:w-60")}>
        {sidebar}
      </div>
      <div className={cn("flex-1 flex-col overflow-hidden", onIndex ? "hidden md:flex" : "flex")}>
        {children}
      </div>
    </div>
  );
}
