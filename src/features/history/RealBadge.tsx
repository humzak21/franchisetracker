import { Badge } from "@/components/ui/misc";

/** Marks a real NFL season from before the franchise (imported or typed in, not played). */
export function RealBadge() {
  return (
    <Badge
      className="border border-dashed border-border-strong bg-transparent"
      title="Real NFL season before the franchise"
    >
      NFL
    </Badge>
  );
}
