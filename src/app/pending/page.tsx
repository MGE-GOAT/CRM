import { redirect } from "next/navigation";
import { Clock, LogOut } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logout } from "@/lib/actions/auth-actions";
import { AutoRefresh } from "@/components/chat/auto-refresh";
import { Logo } from "@/components/logo";

/**
 * Waiting room for a member whose login is pending the owner's approval (or
 * whose approved session has expired). Lives outside the (app) group so it
 * doesn't hit requireUser (which would loop here). Polls for approval and
 * forwards into the app the moment the owner approves.
 */
export default async function PendingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isActive: true, approvedUntil: true },
  });
  if (!user || !user.isActive) redirect("/login");
  // Owner/admin are never gated; an approved member goes straight in.
  if (user.role !== "MEMBER") redirect("/");
  if (user.approvedUntil && user.approvedUntil.getTime() > Date.now()) redirect("/");

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6">
      {/* Poll every few seconds — approval flips the redirect above. */}
      <AutoRefresh interval={5000} />
      <div className="panel w-full max-w-sm p-8 text-center">
        <div className="mb-6 flex justify-center">
          <Logo width={130} />
        </div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[color:var(--gold-hair)] bg-[var(--gold-tint)] text-[color:var(--gold-ink)]">
          <Clock size={26} aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-bold tracking-tight text-text">
          در انتظار تأیید ورود
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          درخواست ورود شما برای مالک ارسال شد. به‌محض تأیید، به‌صورت خودکار وارد
          می‌شوید.
        </p>
        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-2"
          >
            <LogOut size={15} aria-hidden="true" /> خروج
          </button>
        </form>
      </div>
    </main>
  );
}
