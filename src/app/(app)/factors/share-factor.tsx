"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Share2, Hash } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { shareFactorToChannel } from "@/lib/actions/factors";

export type ShareChannel = {
  id: string;
  name: string;
  isDirect: boolean;
  otherColor?: string;
};

/** Share this factor as a card into one of the user's channels/DMs. */
export function ShareFactor({
  factorId,
  channels,
}: {
  factorId: string;
  channels: ShareChannel[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Modal
      title="اشتراک فاکتور در گفتگو"
      trigger={(open) => (
        <button
          onClick={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2"
        >
          <Share2 size={15} aria-hidden="true" /> اشتراک در گفتگو
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-2">
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          {channels.length === 0 && (
            <p className="py-4 text-center text-sm text-muted">
              هنوز گفتگویی ندارید.
            </p>
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {channels.map((c) => (
              <button
                key={c.id}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  start(async () => {
                    const res = await shareFactorToChannel(factorId, c.id);
                    if (res && res.error) {
                      setError(res.error);
                      return;
                    }
                    close();
                    router.push(`/chat/${c.id}`);
                  });
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--gold-tint)] disabled:opacity-50"
              >
                {c.isDirect ? (
                  <Avatar name={c.name} color={c.otherColor ?? "#9a7b0a"} size={24} />
                ) : (
                  <Hash size={16} className="text-muted" aria-hidden="true" />
                )}
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
