"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X, Trash2, Crown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Textarea, SubmitButton } from "@/components/ui/form";
import {
  renameChannel,
  deleteChannel,
  addChannelMember,
  removeChannelMember,
} from "@/lib/actions/chat";

export type MemberInfo = {
  id: string;
  name: string;
  avatarColor: string;
  isCreator: boolean;
  removable: boolean; // actor's role rank >= this member's
};
type Candidate = { id: string; name: string; avatarColor: string };

export function GroupManage({
  channelId,
  name,
  description,
  members,
  candidates,
  currentUserId,
  canManage,
  canDelete,
}: {
  channelId: string;
  name: string;
  description: string | null;
  members: MemberInfo[];
  candidates: Candidate[];
  currentUserId: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function runMember(fn: () => Promise<{ error?: string } | void>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <Modal
      title="اطلاعات کانال"
      trigger={(open) => (
        <button
          onClick={open}
          aria-label="اعضا و مدیریت کانال"
          title="اعضا و افزودن عضو"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-[var(--gold-tint)] hover:text-[color:var(--gold-ink)]"
        >
          <UserPlus size={15} aria-hidden="true" /> اعضا
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-5">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Rename (managers only) */}
          {canManage && (
            <form
              action={async (fd) => {
                setError(null);
                const res = await renameChannel(channelId, fd);
                if (res && res.error) setError(res.error);
                else router.refresh();
              }}
              className="space-y-3"
            >
              <Field label="نام کانال">
                <Input name="name" defaultValue={name} required maxLength={40} />
              </Field>
              <Field label="توضیحات">
                <Textarea name="description" defaultValue={description ?? ""} rows={2} />
              </Field>
              <div className="flex justify-end">
                <SubmitButton>ذخیرهٔ تغییرات</SubmitButton>
              </div>
            </form>
          )}

          {/* Members */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text">
              اعضا ({members.length})
            </h3>
            <ul className="space-y-1">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2"
                >
                  <Avatar name={m.name} color={m.avatarColor} size={26} />
                  <span className="text-sm text-text">{m.name}</span>
                  {m.isCreator && (
                    <span className="inline-flex items-center gap-1 text-xs text-[color:var(--gold-ink)]">
                      <Crown size={12} aria-hidden="true" /> سازنده
                    </span>
                  )}
                  {m.removable && (
                    <button
                      onClick={() => runMember(() => removeChannelMember(channelId, m.id))}
                      disabled={pending}
                      aria-label={m.id === currentUserId ? "خروج از کانال" : `حذف ${m.name}`}
                      title={m.id === currentUserId ? "خروج از کانال" : "حذف از کانال"}
                      className="ms-auto rounded p-1 text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Add member (managers only) */}
          {canManage && candidates.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                <UserPlus size={15} aria-hidden="true" /> افزودن عضو
              </h3>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => runMember(() => addChannelMember(channelId, c.id))}
                    disabled={pending}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-[var(--gold-tint)] disabled:opacity-50"
                  >
                    <Avatar name={c.name} color={c.avatarColor} size={24} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Delete channel (rank >= highest member) */}
          {canDelete && (
            <div className="border-t border-border pt-4">
              <button
                onClick={() => {
                  if (!confirm("این کانال و همهٔ پیام‌هایش برای همیشه حذف شوند؟")) return;
                  setError(null);
                  start(async () => {
                    const res = await deleteChannel(channelId);
                    if (res && res.error) setError(res.error);
                    else {
                      close();
                      router.push("/chat");
                    }
                  });
                }}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden="true" /> حذف کانال
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
