import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";
import { toFa } from "@/lib/format";
import { getSessionUser } from "@/lib/rbac";

export default async function LoginPage() {
  // Only redirect to the app if the session maps to a real, active user
  // (a deleted/disabled account stays here instead of looping).
  const user = await getSessionUser();
  if (user) redirect("/");

  const year = new Date().toLocaleDateString("fa-IR", { calendar: "persian", year: "numeric" });

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Brand strip (RTL start) — warm charcoal, gold atmosphere */}
      <div className="relative hidden overflow-hidden bg-sidebar-bg p-12 text-sidebar-text lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(115% 80% at 88% 8%, rgba(226,181,93,0.22), transparent 55%), radial-gradient(90% 85% at 5% 100%, rgba(226,181,93,0.10), transparent 55%)",
          }}
        />
        <div className="relative">
          <Logo width={170} />
        </div>
        <div className="relative max-w-md">
          <div
            aria-hidden="true"
            className="mb-6 h-[3px] w-14 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, var(--gold-from), var(--gold-mid) 55%, var(--gold-to))",
            }}
          />
          <h1 className="text-4xl font-bold leading-snug tracking-tight">
            هرآنچه تیم شما برای پیشبرد معاملات نیاز دارد.
          </h1>
          <p className="mt-4 leading-relaxed text-sidebar-muted">
            مخاطبین، فروش، وظایف، گزارش‌ها و گفتگوی تیمی — همه در یک فضای
            کاری مشترک.
          </p>
        </div>
        <div className="relative text-sm text-sidebar-muted">
          © {toFa(year)} اسپان هلدینگ
        </div>
      </div>

      {/* Entry form (RTL end) — warm paper + floated auth panel */}
      <div className="relative flex items-center justify-center overflow-hidden p-6 sm:p-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 100% 0%, rgba(226,181,93,0.10), transparent 60%)",
          }}
        />
        <div className="relative w-full max-w-sm animate-in">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo width={150} />
          </div>
          <div className="panel p-7 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">خوش آمدید</h2>
            <p className="mt-1.5 text-sm text-muted">
              برای ادامه، وارد حساب کاربری خود شوید.
            </p>
            <div className="mt-7">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
