"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, LogIn } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { approveMember, dismissJoinRequest } from "@/lib/actions/users";

export type JoinRequest = {
  id: string;
  name: string;
  email: string;
  role: string;
  requestedAt: string; // formatted Jalali date+time
};

/**
 * Owner-only panel of members waiting to enter. Shows who is trying to join
 * and lets the owner approve (until 6pm by default, or a custom time for
 * after-hours) or dismiss the request.
 */
export function JoinRequests({ requests }: { requests: JoinRequest[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Optional per-request custom end time (HH:MM) for after-hours approvals.
  const [times, setTimes] = useState<Record<string, string>>({});

  if (requests.length === 0) return null;

  function run(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-[color:var(--gold-hair)] bg-surface shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2 border-b border-border bg-[var(--gold-tint)] px-4 py-3 text-sm font-bold text-[color:var(--gold-ink)]">
        <LogIn size={16} aria-hidden="true" />
        درخواست‌های ورود ({requests.length})
      </div>
      {error && (
        <p role="alert" className="border-b border-border bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <ul className="divide-y divide-border">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Avatar name={r.name} color="#9a7b0a" size={34} />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted" dir="ltr">
                {r.email}
              </div>
              <div className="mt-0.5 text-xs text-faint">
                نقش: {r.role} · زمان درخواست: {r.requestedAt}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted">
                تا ساعت
                <input
                  type="time"
                  dir="ltr"
                  value={times[r.id] ?? ""}
                  onChange={(e) => setTimes((t) => ({ ...t, [r.id]: e.target.value }))}
                  className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  aria-label="زمان پایان دسترسی (اختیاری)"
                />
              </label>
              <button
                onClick={() => run(() => approveMember(r.id, times[r.id] || undefined))}
                disabled={pending}
                className="btn-gold inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <Check size={15} aria-hidden="true" /> تأیید
              </button>
              <button
                onClick={() => run(() => dismissJoinRequest(r.id))}
                disabled={pending}
                aria-label="رد درخواست"
                title="رد درخواست"
                className="rounded-lg border border-border p-1.5 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="px-4 py-2 text-xs text-muted">
        تأیید بدون تعیین ساعت: تا ساعت ۱۸:۰۰ امروز؛ و پس از پایان ساعت کاری، فقط
        برای یک ساعت فعال می‌شود.
      </p>
    </div>
  );
}
