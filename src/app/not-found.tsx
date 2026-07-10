import Link from "next/link";

// Friendly 404 for any unmatched route.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="logo-gold text-6xl font-black tracking-tight">۴۰۴</div>
      <p className="text-sm text-muted">صفحه‌ای که دنبالش بودید پیدا نشد.</p>
      <Link href="/" className="btn-gold rounded-lg px-4 py-2 text-sm">
        بازگشت به داشبورد
      </Link>
    </div>
  );
}
