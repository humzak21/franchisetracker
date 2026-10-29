import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { PositionBadge } from "@/components/player/PositionBadge";
import { cn } from "@/lib/cn";

type PickerOptionProps = {
  onClick: () => void;
  selected?: boolean;
  disabled?: boolean;
  /** A leading icon, for the actions (add a new player) rather than the people. */
  icon?: ReactNode;
  label: ReactNode;
  position?: string | null;
  /** The school, so two players with one name tell apart; and a college class for a prospect. */
  detail?: string | null;
};

/** One choice in a player picker: a name with its position and school, or an action. */
export function PickerOption({
  onClick,
  selected,
  disabled,
  icon,
  label,
  position,
  detail,
}: PickerOptionProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left hover:bg-surface-2 disabled:opacity-50",
          selected && "bg-elite-1",
        )}
      >
        {icon}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{label}</span>
            {position && <PositionBadge position={position} className="shrink-0" />}
          </span>
          {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
        </span>
        {selected && <Check className="size-4 shrink-0 text-primary" />}
      </button>
    </li>
  );
}
