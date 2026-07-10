import { Phone, Mail, Calendar, StickyNote, ArrowRightLeft } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { formatRelative } from "@/lib/format";
import { activityTypeLabel } from "@/lib/labels";

type Activity = {
  id: string;
  type: string;
  content: string;
  createdAt: Date;
  user: { name: string; avatarColor: string };
};

const ICONS: Record<string, React.ElementType> = {
  NOTE: StickyNote,
  CALL: Phone,
  EMAIL: Mail,
  MEETING: Calendar,
  STAGE_CHANGE: ArrowRightLeft,
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
        هنوز فعالیتی ثبت نشده است.
      </p>
    );
  }

  return (
    <ol>
      {activities.map((a, i) => {
        const Icon = ICONS[a.type] ?? StickyNote;
        const isLast = i === activities.length - 1;
        return (
          <li key={a.id} className="flex gap-3">
            {/* Icon node + refined vertical rule threading through the timeline. */}
            <div className="flex flex-col items-center">
              <span className="z-10 grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-[var(--brand)] ring-4 ring-surface">
                <Icon size={15} aria-hidden="true" />
              </span>
              {!isLast && (
                <span className="mt-1.5 w-px flex-1 bg-border" aria-hidden="true" />
              )}
            </div>
            <div className={`min-w-0 flex-1 pt-0.5 text-sm ${isLast ? "" : "pb-6"}`}>
              <p>
                <span className="font-medium">{a.user.name}</span>{" "}
                <span className="text-muted">
                  {a.type === "STAGE_CHANGE"
                    ? a.content
                    : `· ${activityTypeLabel[a.type] ?? a.type}`}
                </span>
              </p>
              {a.type !== "STAGE_CHANGE" && <p className="mt-0.5 break-words">{a.content}</p>}
              <p className="mt-1 text-xs text-faint">{formatRelative(a.createdAt)}</p>
            </div>
            <Avatar name={a.user.name} color={a.user.avatarColor} size={26} />
          </li>
        );
      })}
    </ol>
  );
}
