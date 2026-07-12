"use client";

import { useRef, useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Send,
  Reply,
  X,
  CornerDownLeft,
  Paperclip,
  Pencil,
  Trash2,
  FileText,
  Check,
  Mic,
  ClipboardCheck,
  ClipboardList,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { sendMessage, editMessage, deleteMessage, acknowledgeTaskMessage } from "@/lib/actions/chat";
import { formatTime, formatDayLabel, dayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ChatAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type ChatMsg = {
  id: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  kind: string;
  acked: boolean;
  factorId: string | null;
  senderId: string;
  senderName: string;
  senderColor: string;
  replyToName: string | null;
  replyToBody: string | null;
  attachments: ChatAttachment[];
};

/** Human-readable file size. */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label="ارسال پیام"
      aria-busy={pending}
      className="btn-gold grid h-10 w-10 shrink-0 place-items-center rounded-lg"
    >
      <Send size={16} aria-hidden="true" />
    </button>
  );
}

function AttachmentView({ a }: { a: ChatAttachment }) {
  const href = `/api/files/${a.id}`;
  if (a.mimeType.startsWith("audio/")) {
    return (
      <audio
        controls
        preload="metadata"
        src={href}
        className="h-10 w-64 max-w-full"
        aria-label={`پیام صوتی: ${a.fileName}`}
      />
    );
  }
  if (a.mimeType.startsWith("image/")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={a.fileName}
          className="max-h-60 max-w-full rounded-lg border border-border object-contain"
        />
      </a>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-[var(--gold-tint)]"
    >
      <FileText size={18} className="shrink-0 text-[color:var(--gold-ink)]" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate">{a.fileName}</span>
        <span className="block text-xs text-muted">{fileSize(a.size)}</span>
      </span>
    </a>
  );
}

export function ChatThread({
  channelId,
  currentUserId,
  canModerate,
  messages,
}: {
  channelId: string;
  currentUserId: string;
  canModerate: boolean;
  messages: ChatMsg[];
}) {
  const router = useRouter();
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [editing, setEditing] = useState<ChatMsg | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [, startAction] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const lastId = messages.at(-1)?.id ?? "none";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastId]);

  // Stop any in-flight recording/timer if the thread unmounts.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /** Send a recorded voice clip through the normal attachment pipeline. */
  async function sendVoice(blob: Blob) {
    const ext = blob.type.includes("ogg") ? "ogg" : "webm";
    const file = new File([blob], `voice-${recSeconds}s.${ext}`, {
      type: blob.type || "audio/webm",
    });
    const fd = new FormData();
    fd.append("files", file);
    fd.append("replyToId", replyTo?.id ?? "");
    setSendError(null);
    const result = await sendMessage(channelId, fd);
    if (result && result.error) {
      setSendError(result.error);
      return;
    }
    setReplyTo(null);
    router.refresh();
  }

  async function startRecording() {
    setSendError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setSendError("مرورگر شما از ضبط صدا پشتیبانی نمی‌کند.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (!cancelledRef.current && blob.size > 0) {
          startAction(() => sendVoice(blob));
        }
        setRecSeconds(0);
      };
      recorderRef.current = rec;
      rec.start();
      setRecSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setSendError("دسترسی به میکروفون داده نشد.");
    }
  }

  function stopRecording(cancel: boolean) {
    cancelledRef.current = cancel;
    recorderRef.current?.stop();
  }

  function clearFiles() {
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleDelete(m: ChatMsg) {
    if (!confirm("این پیام حذف شود؟")) return;
    startAction(async () => {
      await deleteMessage(m.id);
    });
  }

  function handleAck(m: ChatMsg) {
    setSendError(null);
    startAction(async () => {
      const res = await acknowledgeTaskMessage(m.id);
      if (res && res.error) setSendError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div
        className="flex-1 space-y-1 overflow-y-auto bg-bg p-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            هنوز پیامی نیست. سلام کنید 👋
          </p>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
          const grouped =
            !newDay &&
            prev?.senderId === m.senderId &&
            !m.replyToBody &&
            !m.deleted &&
            m.kind === "NORMAL" &&
            prev?.kind === "NORMAL";
          const mine = m.senderId === currentUserId;
          const canDelete = !m.deleted && (mine || canModerate);
          const canEdit = !m.deleted && mine && !!m.body;
          const isEditing = editing?.id === m.id;
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
                  {!grouped && <Avatar name={m.senderName} color={m.senderColor} size={32} />}
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
                    <div className="mb-1 rounded-lg border-s-2 border-[color:var(--gold-mid)] bg-surface-2 px-2 py-1 text-xs text-muted">
                      <span className="font-medium text-[color:var(--gold-ink)]">
                        {m.replyToName}
                      </span>
                      <span className="mx-1">·</span>
                      <span className="line-clamp-1">{m.replyToBody}</span>
                    </div>
                  )}

                  {m.deleted ? (
                    <div className="inline-flex rounded-2xl border border-border bg-surface-2 px-3 py-2 text-sm italic text-faint">
                      پیام حذف شد
                    </div>
                  ) : m.kind === "TASK_ASSIGN" ? (
                    <TaskAssignCard m={m} mine={mine} onAck={() => handleAck(m)} />
                  ) : m.kind === "FACTOR_SHARE" ? (
                    <FactorShareCard m={m} />
                  ) : isEditing ? (
                    <EditForm message={m} onDone={() => setEditing(null)} />
                  ) : (
                    <div className="flex min-w-0 items-start gap-2">
                      <div className="min-w-0 space-y-1.5">
                        {m.body && (
                          <div
                            className={cn(
                              "min-w-0 rounded-2xl border px-3 py-2 text-sm leading-relaxed text-text",
                              mine
                                ? "border-[color:var(--gold-hair)] bg-[var(--gold-tint)]"
                                : "border-border bg-surface-2"
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          </div>
                        )}
                        {m.attachments.map((a) => (
                          <AttachmentView key={a.id} a={a} />
                        ))}
                        {m.editedAt && (
                          <span className="block text-[11px] text-faint">ویرایش‌شده</span>
                        )}
                      </div>

                      {/* hover actions */}
                      <div className="mt-1 flex shrink-0 gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <button
                          onClick={() => {
                            setReplyTo(m);
                            inputRef.current?.focus();
                          }}
                          aria-label="پاسخ"
                          title="پاسخ"
                          className="rounded p-1 text-muted hover:bg-[var(--gold-tint)] hover:text-[color:var(--gold-ink)]"
                        >
                          <Reply size={14} aria-hidden="true" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => setEditing(m)}
                            aria-label="ویرایش"
                            title="ویرایش"
                            className="rounded p-1 text-muted hover:bg-[var(--gold-tint)] hover:text-[color:var(--gold-ink)]"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(m)}
                            aria-label="حذف"
                            title="حذف"
                            className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-[var(--gold-tint)] px-3 py-2 text-xs">
          <CornerDownLeft size={14} className="text-[color:var(--gold-ink)]" aria-hidden="true" />
          <span className="text-muted">
            پاسخ به{" "}
            <span className="font-medium text-[color:var(--gold-ink)]">{replyTo.senderName}</span>:{" "}
            <span className="line-clamp-1 inline-block max-w-[45%] align-bottom sm:max-w-[60%]">
              {replyTo.body ?? "پیوست"}
            </span>
          </span>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="لغو پاسخ"
            className="ms-auto rounded p-0.5 text-muted hover:bg-surface"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Selected files preview */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface-2 px-3 py-2">
          {files.map((f, idx) => (
            <span
              key={idx}
              className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text"
            >
              <FileText size={13} className="shrink-0 text-[color:var(--gold-ink)]" aria-hidden="true" />
              <span className="truncate">{f.name}</span>
            </span>
          ))}
          <button
            onClick={clearFiles}
            className="rounded p-1 text-muted hover:bg-surface"
            aria-label="حذف پیوست‌ها"
            title="حذف پیوست‌ها"
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
      {recording ? (
        <div
          className={`flex items-center gap-3 bg-surface p-3 ${sendError ? "" : "border-t border-border"}`}
        >
          <button
            type="button"
            onClick={() => stopRecording(true)}
            aria-label="لغو ضبط"
            title="لغو ضبط"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
          <div className="flex flex-1 items-center gap-2 text-sm text-text">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
            <span className="tabular-nums">در حال ضبط… {recSeconds} ثانیه</span>
          </div>
          <button
            type="button"
            onClick={() => stopRecording(false)}
            aria-label="ارسال پیام صوتی"
            title="ارسال پیام صوتی"
            className="btn-gold grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
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
            clearFiles();
            setReplyTo(null);
            inputRef.current?.focus();
          }}
          className={`flex items-center gap-2 bg-surface p-3 ${sendError ? "" : "border-t border-border"}`}
        >
          <input type="hidden" name="replyToId" value={replyTo?.id ?? ""} />
          <input
            ref={fileRef}
            type="file"
            name="files"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="پیوست فایل"
            title="پیوست فایل"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-[var(--gold-tint)] hover:text-[color:var(--gold-ink)]"
          >
            <Paperclip size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={startRecording}
            aria-label="ضبط پیام صوتی"
            title="ضبط پیام صوتی"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border text-muted hover:bg-[var(--gold-tint)] hover:text-[color:var(--gold-ink)]"
          >
            <Mic size={16} aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            name="body"
            autoComplete="off"
            aria-label="متن پیام"
            placeholder="پیام خود را بنویسید…"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/50"
          />
          <SendButton />
        </form>
      )}
    </div>
  );
}

/** Task-assignment card with an acknowledge button for the recipient. */
function TaskAssignCard({
  m,
  mine,
  onAck,
}: {
  m: ChatMsg;
  mine: boolean;
  onAck: () => void;
}) {
  const lines = (m.body ?? "").split("\n").filter(Boolean);
  return (
    <div className="max-w-sm overflow-hidden rounded-2xl border border-[color:var(--gold-hair)] bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 border-b border-border bg-[var(--gold-tint)] px-3 py-2 text-sm font-semibold text-[color:var(--gold-ink)]">
        <ClipboardList size={16} aria-hidden="true" />
        وظیفهٔ محول‌شده
      </div>
      <div className="space-y-1 px-3 py-2.5 text-sm text-text">
        {lines.map((line, i) => (
          <p key={i} className="break-words">
            {line}
          </p>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        {m.acked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <ClipboardCheck size={14} aria-hidden="true" /> دیده شد و تأیید گردید
          </span>
        ) : mine ? (
          <span className="text-xs text-muted">در انتظار تأیید گیرنده…</span>
        ) : (
          <button
            onClick={onAck}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          >
            <ClipboardCheck size={14} aria-hidden="true" /> دیدم و در جریانم
          </button>
        )}
      </div>
    </div>
  );
}

/** Shared-factor card with a link to open the live factor. */
function FactorShareCard({ m }: { m: ChatMsg }) {
  const lines = (m.body ?? "").split("\n").filter(Boolean);
  return (
    <div className="max-w-sm overflow-hidden rounded-2xl border border-[color:var(--gold-hair)] bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 border-b border-border bg-[var(--gold-tint)] px-3 py-2 text-sm font-semibold text-[color:var(--gold-ink)]">
        <FileText size={16} aria-hidden="true" /> فاکتور
      </div>
      <div className="space-y-1 px-3 py-2.5 text-sm text-text">
        {lines.map((line, i) => (
          <p key={i} className="break-words">
            {line}
          </p>
        ))}
      </div>
      {m.factorId && (
        <div className="border-t border-border px-3 py-2">
          <Link
            href={`/factors/${m.factorId}`}
            className="btn-gold inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          >
            <FileText size={14} aria-hidden="true" /> مشاهدهٔ فاکتور
          </Link>
        </div>
      )}
    </div>
  );
}

/** Inline edit form for a single message. */
function EditForm({ message, onDone }: { message: ChatMsg; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      action={async (fd) => {
        setError(null);
        const res = await editMessage(message.id, fd);
        if (res && res.error) {
          setError(res.error);
          return;
        }
        onDone();
      }}
      className="space-y-1.5"
    >
      <textarea
        name="body"
        defaultValue={message.body ?? ""}
        rows={2}
        autoFocus
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/40"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="btn-gold inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs"
        >
          <Check size={13} aria-hidden="true" /> ذخیره
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-2.5 py-1 text-xs text-muted hover:bg-surface-2"
        >
          لغو
        </button>
      </div>
    </form>
  );
}
