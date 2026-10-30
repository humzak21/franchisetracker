import { LineChart as LineChartIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { chosenCurves, pointsCurves } from "@shared/stats";
import {
  formatTeamSeasonStat,
  TEAM_SEASON_STAT_KEYS,
  TEAM_SEASON_STATS,
  type TeamSeasonStatKey,
} from "@shared/stats/teamSeasonRegistry";
import { CumulativeChart } from "@/components/data/CumulativeChart";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { SeasonBars } from "@/components/data/SeasonBars";
import { TrendChart } from "@/components/data/TrendChart";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";

const RESULTS = [
  { key: "wins", label: "Wins" },
  { key: "losses", label: "Losses" },
];
const POINTS = [
  { key: "pointsFor", label: "Scored" },
  { key: "pointsAgainst", label: "Allowed" },
];

/** The team across its franchise seasons: results, points, one stat at a time, points race. */
export function TeamCurves() {
  const data = useQuery(api.stats.trends.team, {});
  const ranks = useQuery(api.league.teamStats.trends, {});
  const [stat, setStat] = useState<TeamSeasonStatKey>("pointsPg");
  const curves = useMemo(() => (data ? chosenCurves(pointsCurves(data.seasons)) : []), [data]);

  if (data === undefined) return <Skeleton className="h-72 rounded-xl" />;
  if (data.seasons.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No seasons to chart"
        description="Trends build up from each game's final score."
      />
    );
  }
  const options = TEAM_SEASON_STAT_KEYS.filter((k) => ranks?.some((r) => r.statKey === k));
  const points = ranks?.find((r) => r.statKey === stat)?.points ?? [];
  const { better } = TEAM_SEASON_STATS[stat];
  const format = (value: number) => formatTeamSeasonStat(stat, value);
  const yearly = points.map((p, i) => {
    const before = points[i - 1];
    return { ...p, delta: before ? p.value - before.value : null };
  });

  return (
    <div className="space-y-8">
      <Section title="Results">
        <div className="grid gap-3 @desktop:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface p-3">
            <SeasonBars
              valueLabel="Wins and losses"
              series={RESULTS}
              seasons={data.seasons.map((s) => ({
                year: s.year,
                values: { wins: s.record.w, losses: s.record.l },
              }))}
            />
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <SeasonBars
              valueLabel="Points scored and allowed"
              series={POINTS}
              seasons={data.seasons.map((s) => ({
                year: s.year,
                values: { pointsFor: s.pointsFor, pointsAgainst: s.pointsAgainst },
              }))}
            />
          </div>
        </div>
      </Section>

      {options.length > 0 && (
        <Section
          title="By season"
          actions={
            <Select
              className="w-56 max-w-full"
              aria-label="Team stat to chart"
              value={stat}
              onValueChange={(key) => setStat(key as TeamSeasonStatKey)}
              options={options.map((key) => ({ value: key, label: TEAM_SEASON_STATS[key].label }))}
            />
          }
        >
          <div className="space-y-3">
            {points.length > 1 && (
              <div className="rounded-xl border border-border bg-surface p-3">
                <TrendChart
                  scale="auto"
                  format={format}
                  valueLabel={TEAM_SEASON_STATS[stat].label}
                  points={points.map((p) => ({
                    key: String(p.year),
                    label: String(p.year),
                    group: String(p.year),
                    value: p.value,
                  }))}
                />
              </div>
            )}
            <ul className="flex flex-wrap gap-2 text-sm">
              {yearly.map((p) => (
                <li
                  key={p.year}
                  className="inline-flex items-baseline gap-2 rounded-lg border border-border bg-surface px-2.5 py-1"
                >
                  <span className="num text-xs text-muted-foreground">{p.year}</span>
                  <span className="num font-semibold">{format(p.value)}</span>
                  <DeltaBadge delta={p.delta} better={better} format={format} />
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      <Section title="Points race" description="Points scored game by game, regular season.">
        <div className="rounded-xl border border-border bg-surface p-3">
          <CumulativeChart
            valueLabel="Points scored"
            series={curves.map((c) => ({
              key: `y${c.year}`,
              label: c.key === "best" ? `${c.year} (best)` : String(c.year),
              points: c.points,
            }))}
          />
        </div>
      </Section>
    </div>
  );
}
