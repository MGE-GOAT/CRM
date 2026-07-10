import { MessageSquare } from "lucide-react";

export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[color:var(--gold-hair)] bg-[var(--gold-tint)] text-[color:var(--gold-ink)]">
        <MessageSquare size={28} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-text">گفتگوهای تیمی شما</h2>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed">
        برای شروع گفتگو، یک کانال را انتخاب کنید یا از نوار کناری یک پیام مستقیم آغاز کنید.
      </p>
    </div>
  );
}
