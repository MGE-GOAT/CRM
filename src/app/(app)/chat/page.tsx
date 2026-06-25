import { MessageSquare } from "lucide-react";

export default function ChatEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-muted">
      <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-[var(--brand)]">
        <MessageSquare size={28} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-text">گفتگوهای تیمی شما</h2>
      <p className="mt-1 max-w-xs text-sm">
        برای شروع گفتگو، یک کانال را انتخاب کنید یا از نوار کناری یک پیام مستقیم آغاز کنید.
      </p>
    </div>
  );
}
