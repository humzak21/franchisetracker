import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  formatStat,
  isStatKey,
  RECORD_BOOK_LABELS,
  RECORD_SCOPE_LABELS,
  STAT_REGISTRY,
  STREAK_LABELS,
  type StreakKey,
} from "@shared/stats";
import { FactChip } from "@/components/data/FactChip";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";

/** Placements shown before "Show all": a star quarterback makes dozens of lists. */
const SHOWN = 12;

/**
 * Every records list the player makes (top twenty of the team, franchise-era and all-time books)
 * and his streaks, each at its longest so a run that ended stays on his page. Hidden until there
 * is one of either.
 */
export function PlayerHighlights({ playerId }: { playerId: Id<"players"> }) {
  const placements = useQuery(api.stats.records.forPlayer, { playerId });
  const streaks = useQuery(api.stats.streaks.forPlayer, { playerId });
  const [all, setAll] = useState(false);
  if (!placements || !streaks || (placements.length === 0 && streaks.length === 0)) return null;
  const shown = all ? placements : placements.slice(0, SHOWN);

  return (
    <Section title="Records and streaks">
      <div className="flex flex-wrap gap-2">
        {shown.map((p) => {
          const stat = isStatKey(p.statKey) ? STAT_REGISTRY[p.statKey].label : p.statKey;
          const span = p.firstYear !== null && p.firstYear !== p.year ? `${p.firstYear}–${p.year}` : p.year;
          return (
            <FactChip
              key={p._id}
              active={p.rank === 1}
              value={isStatKey(p.statKey) ? formatStat(p.statKey, p.value) : p.value}
              label={`${p.rank === 1 ? "Record" : `#${p.rank}`} · ${stat}`}
              detail={`${RECORD_BOOK_LABELS[p.book]} · ${RECORD_SCOPE_LABELS[p.scope].toLowerCase()}${p.split === "postseason" ? ", playoffs" : ""}${span ? ` · ${span}` : ""}`}
            />
          );
        })}
        {streaks.map((s) => (
          <FactChip
            key={s.key}
            active={s.current >= 2}
            value={s.longest}
            label={`Longest: ${STREAK_LABELS[s.key as StreakKey] ?? s.key}`}
            detail={s.current >= 2 ? `Running now: ${s.current}` : "Ended"}
          />
        ))}
      </div>
      {placements.length > SHOWN && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${placements.length} records`}
        </Button>
      )}
    </Section>
  );
}
