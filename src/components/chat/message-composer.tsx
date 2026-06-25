"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { sendMessage } from "@/lib/actions/chat";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-600)] disabled:opacity-60"
      aria-label="ارسال پیام"
    >
      <Send size={16} aria-hidden="true" />
    </button>
  );
}

export function MessageComposer({ channelId }: { channelId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="border-t border-border bg-surface">
      {error && (
        <p role="alert" className="px-3 pt-2 text-xs text-red-600">
          {error}
        </p>
      )}
      <form
        ref={ref}
        action={async (fd) => {
          setError(null);
          const result = await sendMessage(channelId, fd);
          if (result && result.error) {
            setError(result.error);
            return;
          }
          ref.current?.reset();
          inputRef.current?.focus();
        }}
        className="flex items-center gap-2 p-3"
      >
        <input
          ref={inputRef}
          name="body"
          required
          autoComplete="off"
          placeholder="پیام خود را بنویسید…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
        />
        <SendButton />
      </form>
    </div>
  );
}
