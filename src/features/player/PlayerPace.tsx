import { useMemo } from "react";
import { formatStat, getStat, paceGoals, PACE_GOAL_LABELS, type StatKey } from "@shared/stats";
import { PaceBar } from "@/components/data/PaceBar";
import { Section } from "@/components/layout/Section";
import type { PlayerTrends } from "./types";

/** Stats shown; the lead stat gets every target, the others only the next one. */
const STATS_SHOWN = 3;

/** On pace for what (FEATURES.md 5.4): only while a season is under way and the player is in it. */
export function PlayerPace({ trends, stats }: { trends: PlayerTrends; stats: readonly StatKey[] }) {
  const rows = useMemo(() => paceGoals(trends, stats).slice(0, STATS_SHOWN), [trends, stats]);
  if (rows.length === 0) return null;
  return (
    <Section
      id="pace"
      title="Pace"
      description={`${trends.live?.year} season, if the rest goes the same way.`}
    >
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        {rows.flatMap((row, i) =>
          row.checks.slice(0, i === 0 ? undefined : 1).map((check) => {
            const { label } = getStat(row.stat);
            const goal = PACE_GOAL_LABELS[check.key];
            return (
              <PaceBar
                key={`${row.stat}-${check.key}`}
                label={`${label}: ${goal}`}
                accessibleLabel={`${label}, ${goal}`}
                value={row.total}
                target={check.target}
                projected={check.projected}
                reading={`${formatStat(row.stat, row.total)} of ${formatStat(row.stat, check.target)}`}
                caption={
                  <>
                    On pace for {formatStat(row.stat, Math.round(check.projected ?? 0))}
                    {check.perGameNeeded !== null && check.perGameNeeded > 0
                      ? ` · ${check.perGameNeeded.toFixed(1)} a game to get there`
                      : ""}
                  </>
                }
              />
            );
          }),
        )}
      </div>
    </Section>
  );
}
