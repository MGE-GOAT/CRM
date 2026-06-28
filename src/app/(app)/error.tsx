"use client";

import { AlertTriangle } from "lucide-react";

// Catches any unhandled error thrown while rendering an authenticated page,
// so the user sees a friendly message instead of a crash.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle size={26} aria-hidden="true" />
      </div>
      <h1 className="text-xl font-bold">مشکلی پیش آمد</h1>
      <p className="max-w-md text-sm text-muted">
        متأسفیم، خطایی رخ داد. لطفاً دوباره تلاش کنید. اگر مشکل ادامه داشت، چند لحظه بعد دوباره امتحان کنید.
      </p>
      <button onClick={reset} className="btn-gold rounded-lg px-4 py-2 text-sm">
        تلاش مجدد
      </button>
    </div>
  );
}
