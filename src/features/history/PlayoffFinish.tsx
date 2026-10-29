import type { Doc } from "@convex/_generated/dataModel";
import { finishTiers, playoffFinishLabel } from "@shared/history/seasonRecord";
import { formatOrdinal } from "@shared/stats";
import { Highlight } from "@/components/data/Highlight";

type Record = NonNullable<Doc<"seasons">["userRecord"]>;

/** A season's seed and playoff result, the top seed and a Super Bowl win marked like elite stats. */
export function PlayoffFinish({ year, record }: { year: number; record: Record }) {
  const { playoffResult, seed } = record;
  if (!playoffResult) return null;
  const tiers = finishTiers(record);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {seed !== undefined && (
        <>
          <span>
            <Highlight tier={tiers.seed}>{formatOrdinal(seed)} seed</Highlight>
          </span>
          <span aria-hidden className="text-subtle-foreground">
            ·
          </span>
        </>
      )}
      <span>
        <Highlight tier={tiers.playoffs}>{playoffFinishLabel(playoffResult, year)}</Highlight>
      </span>
    </span>
  );
}
