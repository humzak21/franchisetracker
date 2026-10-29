import { MoreHorizontal, RotateCcw, UserRoundCheck } from "lucide-react";
import { AWARD_INFO, type AwardType } from "@shared/domain";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/button";

/** Assigning or clearing a season award's winner. */
export function SlotMenu({
  type,
  label,
  assigned,
  onAssign,
  onClear,
}: {
  type: AwardType;
  /** The slot's name for screen readers, with its conference. */
  label: string;
  /** A winner is stored for the season, so clearing it is possible. */
  assigned: boolean;
  onAssign: () => void;
  onClear: () => void;
}) {
  const counted = AWARD_INFO[type].cadence === "counted";
  return (
    <ActionMenu
      label={`${label} actions`}
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`${label} actions`}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        { id: "assign", label: "Assign winner", icon: UserRoundCheck, onSelect: onAssign },
        ...(assigned
          ? [
              {
                id: "clear",
                label: counted ? "Back to the count" : "Remove winner",
                icon: RotateCcw,
                onSelect: onClear,
              },
            ]
          : []),
      ]}
    />
  );
}
