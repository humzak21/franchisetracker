import type { GameResult } from "@shared/domain";
import { cn } from "@/lib/cn";

const tone: Record<GameResult, string> = {
  W: "bg-win/15 text-win",
  L: "bg-loss/15 text-loss",
  T: "bg-tie/15 text-tie",
};

type ResultBadgeProps = {
  result: GameResult | null;
  us: number | null;
  them: number | null;
  overtime?: boolean;
  className?: string;
};

/** "W 31-17 OT": the result from the user team's side. Renders nothing for unplayed games. */
export function ResultBadge({ result, us, them, overtime, className }: ResultBadgeProps) {
  if (!result || us === null || them === null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("grid size-6 place-items-center rounded-md text-xs font-bold", tone[result])}>
        {result}
      </span>
      <span className="num font-semibold">
        {us}-{them}
      </span>
      {overtime && <span className="rounded bg-ot/15 px-1 py-px text-[10px] font-bold text-ot">OT</span>}
    </span>
  );
}
