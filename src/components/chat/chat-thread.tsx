"use client";

import { useRef, useState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Send, Reply, X, CornerDownLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage } from "@/lib/actions/chat";
import { formatTime, formatDayLabel, dayKey } from "@/lib/format";

export type ChatMsg = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  replyToName: string | null;
  replyToBody: string | null;
};

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="ارسال پیام"
      aria-busy={pending}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--brand)] text-white transition hover:bg-[var(--brand-600)] disabled:opacity-60"
    >
      <Send size={16} aria-hidden="true" />
    </button>
  );
}

export function ChatThread({
  channelId,
  currentUserId,
  messages,
}: {
  channelId: string;
  currentUserId: string;
  messages: ChatMsg[];
}) {
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastId = messages.at(-1)?.id ?? "none";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 space-y-1 overflow-y-auto bg-bg p-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            هنوز پیامی نیست. سلام کنید 👋
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const grouped = !newDay && prev?.senderId === m.senderId && !m.replyToBody;
          const mine = m.senderId === currentUserId;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full border border-border bg-surface px-3 py-0.5 text-xs text-muted">
                    {formatDayLabel(m.createdAt)}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              <div className={`group flex gap-2.5 ${grouped ? "mt-0.5" : "mt-3"}`}>
                <div className="w-8 shrink-0">
                  {!grouped && (
                    <Avatar name={m.senderName} color={m.senderColor} size={32} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">
                        {mine ? "شما" : m.senderName}
                      </span>
                      <span className="text-xs text-muted">{formatTime(m.createdAt)}</span>
                    </div>
                  )}
                  {/* quoted reply */}
                  {m.replyToBody && (
                    <div className="mb-1 border-s-2 border-[var(--brand)]/50 bg-gray-50 ps-2 py-1 text-xs text-muted">
                      <span className="font-medium text-[var(--brand-600)]">
                        {m.replyToName}
                      </span>
                      <span className="mx-1">·</span>
                      <span className="line-clamp-1">{m.replyToBody}</span>
                    </div>
                  )}
                  <div className="flex min-w-0 items-start gap-2">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{m.body}</p>
                    <button
                      onClick={() => {
                        setReplyTo(m);
                        inputRef.current?.focus();
                      }}
                      aria-label="پاسخ"
                      title="پاسخ"
                      className="mt-0.5 shrink-0 rounded p-1 text-muted opacity-0 transition hover:bg-gray-100 hover:text-text group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <Reply size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-brand-50 px-3 py-2 text-xs">
          <CornerDownLeft size={14} className="text-[var(--brand-600)]" aria-hidden="true" />
          <span className="text-muted">
            پاسخ به <span className="font-medium text-[var(--brand-600)]">{replyTo.senderName}</span>:{" "}
            <span className="line-clamp-1 inline-block max-w-[45%] align-bottom sm:max-w-[60%]">{replyTo.body}</span>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="لغو پاسخ"
            className="ms-auto rounded p-0.5 text-muted hover:bg-white"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Composer */}
      {sendError && (
        <p role="alert" className="border-t border-border bg-surface px-3 pt-2 text-xs text-red-600">
          {sendError}
        </p>
      )}
      <form
        ref={formRef}
        action={async (fd) => {
          setSendError(null);
          const result = await sendMessage(channelId, fd);
          if (result && result.error) {
            setSendError(result.error);
            return;
          }
          formRef.current?.reset();
          setReplyTo(null);
          inputRef.current?.focus();
        }}
        className={`flex items-center gap-2 bg-surface p-3 ${sendError ? "" : "border-t border-border"}`}
      >
        <input type="hidden" name="replyToId" value={replyTo?.id ?? ""} />
        <input
          ref={inputRef}
          name="body"
          required
          autoComplete="off"
          aria-label="متن پیام"
          placeholder="پیام خود را بنویسید…"
          className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/50"
        />
        <SendButton />
      </form>
    </div>
  );
}
