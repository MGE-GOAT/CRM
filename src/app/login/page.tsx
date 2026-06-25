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
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Right (RTL start): brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-sidebar-bg p-12 text-white">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 15%, rgba(212,175,55,.28), transparent 45%), radial-gradient(circle at 20% 85%, rgba(212,175,55,.16), transparent 45%)",
          }}
        />
        <div className="relative">
          <Logo width={170} />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-snug">
            هرآنچه تیم شما برای پیشبرد معاملات نیاز دارد.
          </h1>
          <p className="mt-4 text-white/65 leading-relaxed">
            مخاطبین، فروش، وظایف، گزارش‌ها و گفتگوی تیمی — همه در یک فضای
            کاری مشترک.
          </p>
        </div>
        <div className="relative text-sm text-white/40">
          © {toFa(year)} اسپان هلدینگ
        </div>
      </div>

      {/* Left (RTL end): entry form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm animate-in">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo width={150} />
          </div>
          <h2 className="text-2xl font-bold">خوش آمدید</h2>
          <p className="mt-1 text-sm text-muted">
            برای ادامه، وارد حساب کاربری خود شوید.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
