import { api } from "@convex/_generated/api";
import { STREAK_LABELS, type StreakKey } from "@shared/stats";
import { FactChip } from "@/components/data/FactChip";
import { useQuery } from "@/lib/convex/useQuery";

/** The team's streaks as chips; nothing at all until there is a streak to show. */
export function TeamStreaks() {
  const data = useQuery(api.stats.streaks.all, {});
  if (!data || data.team.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {data.team.map((s) => (
        <FactChip
          key={s.key}
          value={s.current}
          label={STREAK_LABELS[s.key as StreakKey] ?? s.key}
          detail={`Longest ${s.longest}`}
          active={s.current >= 2}
        />
      ))}
    </div>
  );
}
