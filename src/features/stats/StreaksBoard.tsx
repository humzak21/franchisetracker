import { Link } from "@tanstack/react-router";
import { Flame } from "lucide-react";
import { api } from "@convex/_generated/api";
import { STREAK_LABELS, type StreakKey } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { FactChip } from "@/components/data/FactChip";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

const label = (key: string) => STREAK_LABELS[key as StreakKey] ?? key;

/** Team and player streaks (FEATURES.md 5.5), still-running ones lit in the team accent. */
export function StreaksBoard() {
  const data = useQuery(api.stats.streaks.all, {});
  if (data === undefined) return <Skeleton className="h-40 rounded-xl" />;
  if (data.team.length === 0 && data.players.length === 0) {
    return <EmptyState icon={Flame} title="No streaks yet" description="Two in a row starts a streak." />;
  }
  return (
    <div className="space-y-6">
      {data.team.length > 0 && (
        <Section title="Team">
          <div className="flex flex-wrap gap-2">
            {data.team.map((s) => (
              <FactChip
                key={s.key}
                value={s.current}
                label={label(s.key)}
                detail={`Longest ${s.longest}`}
                active={s.current >= 2}
              />
            ))}
          </div>
        </Section>
      )}
      {data.players.length > 0 && (
        <Section title="Players">
          <ul className="flex flex-wrap gap-2">
            {data.players.map((s) => (
              <li key={`${s.player._id}-${s.key}`} className="max-w-full">
                <Link to="/players/$playerId" params={{ playerId: s.player._id }}>
                  <FactChip
                    value={s.current}
                    label={s.player.name}
                    detail={`${label(s.key)} · longest ${s.longest}`}
                    active={s.current >= 2}
                    className="hover:border-border-strong"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
