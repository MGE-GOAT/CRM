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
    <ol className="space-y-1">
      {activities.map((a) => {
        const Icon = ICONS[a.type] ?? StickyNote;
        return (
          <li key={a.id} className="flex gap-3 rounded-lg p-2 hover:bg-gray-50">
            <div className="relative flex flex-col items-center">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-[var(--brand)]">
                <Icon size={15} />
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-0.5 text-sm">
              <p>
                <span className="font-medium">{a.user.name}</span>{" "}
                <span className="text-muted">
                  {a.type === "STAGE_CHANGE"
                    ? a.content
                    : `· ${activityTypeLabel[a.type] ?? a.type}`}
                </span>
              </p>
              {a.type !== "STAGE_CHANGE" && <p className="mt-0.5 break-words">{a.content}</p>}
              <p className="mt-0.5 text-xs text-muted">{formatRelative(a.createdAt)}</p>
            </div>
            <Avatar name={a.user.name} color={a.user.avatarColor} size={26} />
          </li>
        );
      })}
    </ol>
  );
}
