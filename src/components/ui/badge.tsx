import { cn } from "@/lib/utils";
import { stageLabel, priorityLabel } from "@/lib/labels";

export function Badge({
  children,
  color,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) {
  if (color) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
          className
        )}
        style={{ backgroundColor: `${color}1a`, color }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600",
        className
      )}
    >
      {children}
    </span>
  );
}

// Darker tones so the colored text passes AA on the 10% tint background.
const STAGE_COLORS: Record<string, string> = {
  LEAD: "#4b5563",
  QUALIFIED: "#0369a1",
  PROPOSAL: "#92600a",
  NEGOTIATION: "#6d28d9",
  WON: "#047857",
  LOST: "#b91c1c",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <Badge color={STAGE_COLORS[stage] ?? "#64748b"}>
      {stageLabel[stage] ?? stage}
    </Badge>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#4b5563",
  MEDIUM: "#92600a",
  HIGH: "#b91c1c",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge color={PRIORITY_COLORS[priority] ?? "#64748b"}>
      {priorityLabel[priority] ?? priority}
    </Badge>
  );
}
