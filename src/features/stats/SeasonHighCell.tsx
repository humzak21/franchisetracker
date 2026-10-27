import { Link } from "@tanstack/react-router";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel } from "@shared/domain";
import type { SeasonHigh, StatKey } from "@shared/stats";
import { StatCell } from "@/components/data/StatCell";

/** A season high: the registry-formatted value and the week it came in, linking to that box score. */
export function SeasonHighCell({ stat, high }: { stat: StatKey; high: SeasonHigh<Id<"games">> | undefined }) {
  if (!high) return <StatCell stat={stat} value={null} />;
  return (
    <span className="inline-flex items-baseline justify-end gap-1.5">
      <StatCell stat={stat} value={high.value} />
      <Link
        to="/games/$gameId"
        params={{ gameId: high.gameId }}
        title={`${weekLabel(high.weekKey, "long")} box score`}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline pointer-coarse:touch-target"
      >
        {weekLabel(high.weekKey)}
      </Link>
    </span>
  );
}
