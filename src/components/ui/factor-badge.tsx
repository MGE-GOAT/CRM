import { Badge } from "@/components/ui/badge";
import { STATE_LABEL } from "@/lib/factor";
import type { FactorState } from "@prisma/client";

// Darker tones so colored text passes AA on the 10% tint background.
const STATE_COLORS: Record<FactorState, string> = {
  INITIAL: "#92600a",
  FOLLOWING_UP: "#6d28d9",
  PAID: "#047857",
  SENDING: "#0369a1",
  EXIT: "#4b5563",
  CANCELED: "#b91c1c",
};

export function StateBadge({ state }: { state: FactorState }) {
  return <Badge color={STATE_COLORS[state]}>{STATE_LABEL[state]}</Badge>;
}
