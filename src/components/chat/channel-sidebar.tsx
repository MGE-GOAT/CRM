"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Hash, Plus, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { Field, Input, SubmitButton } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type Channel = {
  id: string;
  name: string;
  isDirect: boolean;
  otherColor?: string;
  unread: number;
};
type UserOption = { id: string; name: string; avatarColor: string };

export function ChannelSidebar({
  channels,
  users,
  ownerId,
  createChannel,
  startDirectMessage,
}: {
  channels: Channel[];
  users: UserOption[];
  ownerId: string;
  createChannel: (formData: FormData) => Promise<{ id?: string; error?: string }>;
  startDirectMessage: (userId: string) => Promise<{ id?: string; error?: string }>;
}) {
  const params = useParams();
  const router = useRouter();
  const activeId = params?.channelId as string | undefined;
  const [, start] = useTransition();
  const [dmError, setDmError] = useState<string | null>(null);

  const groups = channels.filter((c) => !c.isDirect);
  const dms = channels.filter((c) => c.isDirect);

  function openDm(userId: string) {
    setDmError(null);
    start(async () => {
      const result = await startDirectMessage(userId);
      if (result.id) router.push(`/chat/${result.id}`);
      else setDmError(result.error ?? "شروع گفتگو ناموفق بود.");
    });
  }

  return (
    <aside aria-label="کانال‌های گفتگو" className="flex h-full w-full shrink-0 flex-col border-e border-border bg-surface md:w-60">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="font-semibold">گفتگوی تیمی</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {/* Channels */}
        <div>
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium tracking-wide text-muted">
              کانال‌ها
            </span>
            <NewChannelButton createChannel={createChannel} users={users} ownerId={ownerId} />
          </div>
          {groups.map((c) => (
            <ChannelLink key={c.id} channel={c} active={activeId === c.id} />
          ))}
        </div>

        {/* Direct messages */}
        <div>
          <span className="px-2 text-xs font-medium tracking-wide text-muted">
            پیام‌های مستقیم
          </span>
          {dms.map((c) => (
            <ChannelLink key={c.id} channel={c} active={activeId === c.id} />
          ))}

          <div className="mt-1 border-t border-border pt-2">
            <span className="px-2 text-xs text-muted">شروع گفتگو</span>
            {dmError && (
              <p role="alert" className="px-2 py-1 text-xs text-red-600">
                {dmError}
              </p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => openDm(u.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-[var(--gold-tint)]"
              >
                <Avatar name={u.name} color={u.avatarColor} size={22} />
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ChannelLink({
  channel,
  active,
}: {
  channel: Channel;
  active: boolean;
}) {
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm",
        active
          ? "bg-brand-50 text-[var(--brand-600)]"
          : "text-muted hover:bg-[var(--gold-tint)]"
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        {channel.isDirect ? (
          <Avatar name={channel.name} color={channel.otherColor ?? "#6366f1"} size={22} />
        ) : (
          <Hash size={16} className="text-muted" />
        )}
        <span className="truncate">{channel.name}</span>
      </span>
      {channel.unread > 0 && (
        <span className="rounded-full bg-[var(--brand)] px-1.5 text-xs font-medium text-white">
          {channel.unread}
        </span>
      )}
    </Link>
  );
}

function NewChannelButton({
  createChannel,
  users,
  ownerId,
}: {
  createChannel: (formData: FormData) => Promise<{ id?: string; error?: string }>;
  users: UserOption[];
  ownerId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="کانال جدید"
      trigger={(open) => (
        <button
          onClick={open}
          className="rounded p-1 text-muted hover:bg-[var(--gold-tint)] hover:text-text"
          aria-label="کانال جدید"
          title="کانال جدید"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <form
          action={async (fd) => {
            setError(null);
            const result = await createChannel(fd);
            if (result.error || !result.id) {
              setError(result.error ?? "خطایی رخ داد. دوباره تلاش کنید.");
              return;
            }
            close();
            router.push(`/chat/${result.id}`);
          }}
          className="space-y-4"
        >
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Field label="نام کانال">
            <Input name="name" required placeholder="بازاریابی" />
          </Field>
          <Field label="توضیحات">
            <Input name="description" placeholder="این کانال درباره چیست؟" />
          </Field>

          {/* Member picker — you and the owner are always in; pick the rest. */}
          <div>
            <span className="mb-1.5 block text-sm font-medium">اعضا</span>
            <p className="mb-2 flex items-center gap-1 text-xs text-muted">
              <MessageCircle size={13} /> شما و مالک همیشه عضو هستید؛ بقیه را انتخاب کنید.
            </p>
            <div className="max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
              {users.map((u) => {
                const isOwner = u.id === ownerId;
                return (
                  <label
                    key={u.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                      isOwner ? "opacity-70" : "cursor-pointer hover:bg-[var(--gold-tint)]",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="members"
                      value={u.id}
                      defaultChecked={isOwner}
                      disabled={isOwner}
                      className="accent-[var(--gold-ink)]"
                    />
                    <Avatar name={u.name} color={u.avatarColor} size={22} />
                    <span>{u.name}</span>
                    {isOwner && <span className="text-xs text-muted">(مالک · همیشه)</span>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SubmitButton>ایجاد کانال</SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
