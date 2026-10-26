import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  formatStat,
  isStatKey,
  RECORD_SCOPE_LABELS,
  STAT_REGISTRY,
  STREAK_LABELS,
  type StreakKey,
} from "@shared/stats";
import { FactChip } from "@/components/data/FactChip";
import { Section } from "@/components/layout/Section";

/** Franchise records the player holds and their streaks; hidden until there is one of either. */
export function PlayerHighlights({ playerId }: { playerId: Id<"players"> }) {
  const records = useQuery(api.stats.records.forPlayer, { playerId });
  const streaks = useQuery(api.stats.streaks.forPlayer, { playerId });
  if (!records || !streaks || (records.length === 0 && streaks.length === 0)) return null;

  return (
    <Section title="Records and streaks">
      <div className="flex flex-wrap gap-2">
        {records.map((r) => (
          <FactChip
            key={r._id}
            active
            value={isStatKey(r.statKey) ? formatStat(r.statKey, r.value) : r.value}
            label={isStatKey(r.statKey) ? STAT_REGISTRY[r.statKey].label : r.statKey}
            detail={`Franchise record · ${RECORD_SCOPE_LABELS[r.scope].toLowerCase()}${r.split === "postseason" ? ", playoffs" : ""}${r.year ? ` · ${r.year}` : ""}`}
          />
        ))}
        {streaks.map((s) => (
          <FactChip
            key={s.key}
            active={s.current >= 2}
            value={s.current}
            label={STREAK_LABELS[s.key as StreakKey] ?? s.key}
            detail={`Longest ${s.longest}`}
          />
        ))}
      </div>
    </Section>
  );
}
