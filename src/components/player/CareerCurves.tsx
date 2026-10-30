import { useMemo, useState } from "react";
import {
  chosenCurves,
  formatStat,
  getStat,
  MARKS,
  recordPace,
  rollingAverage,
  ROLLING_WINDOW,
  seasonCurves,
  trendStats,
  yearOverYear,
  type CurveKey,
  type LoggedGame,
  type MarkStat,
  type SeasonFigures,
  type StatKey,
} from "@shared/stats";
import { CumulativeChart, type CumulativeSeries } from "@/components/data/CumulativeChart";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { TrendChart } from "@/components/data/TrendChart";
import { Section } from "@/components/layout/Section";
import { Select } from "@/components/ui/select";
import { LineChart as LineChartIcon } from "lucide-react";

export type CareerCurvesData = {
  gamesPerSeason: number;
  seasons: readonly (SeasonFigures & { age: number | null; imported: boolean })[];
  games: readonly LoggedGame[];
  records: readonly { statKey: string; value: number; year: number | null }[];
  /** The season being played: a record it holds is no pace to race. */
  live?: { year: number } | null;
};

const CURVE_LABEL: Record<CurveKey, (year: number) => string> = {
  latest: (year) => String(year),
  previous: (year) => String(year),
  best: (year) => `${year} (best)`,
};

/** How the chart reads a stat, in the registry's format. */
const formatter = (stat: StatKey) => (value: number) => formatStat(stat, value);

function YearTable({ stat, data }: { stat: StatKey; data: CareerCurvesData }) {
  const changes = yearOverYear(data.seasons, stat);
  const format = formatter(stat);
  const { better, label } = getStat(stat);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface" data-swipe-ignore>
      <table className="w-full text-sm">
        <caption className="sr-only">{label} by season</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">Season</th>
            <th className="px-3 py-2 text-right font-medium">Age</th>
            <th className="px-3 py-2 text-right font-medium">G</th>
            <th className="px-3 py-2 text-right font-medium">{getStat(stat).abbr}</th>
            <th className="px-3 py-2 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...changes].reverse().map((change) => {
            const season = data.seasons.find((s) => s.year === change.year);
            return (
              <tr key={change.year}>
                <th scope="row" className="px-3 py-2 text-left font-medium">
                  <span className="num">{change.year}</span>
                  {season?.imported && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">NFL</span>
                  )}
                </th>
                <td className="num px-3 py-2 text-right text-muted-foreground">{season?.age ?? "—"}</td>
                <td className="num px-3 py-2 text-right text-muted-foreground">{season?.gamesPlayed}</td>
                <td className="num px-3 py-2 text-right font-semibold">{format(change.value)}</td>
                <td className="px-3 py-2 text-right">
                  <DeltaBadge
                    delta={change.delta}
                    better={better}
                    format={format}
                    muted={change.smallSample}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A career as curves, for the player page and Stats → Trends: a stat season by season with each
 * change, then each season's running total against the last, the best and the franchise record,
 * and a rolling average of the games. Imported seasons have no games, so curves start at the franchise.
 */
export function CareerCurves({
  data,
  initialStat,
  anchors,
}: {
  data: CareerCurvesData;
  /** The stat to open on, usually the position's lead stat. */
  initialStat?: StatKey;
  /** Section ids for a page's jump links. */
  anchors?: { trends: string; cumulative: string };
}) {
  const options = useMemo(() => trendStats(data.seasons), [data.seasons]);
  const [picked, setPicked] = useState<StatKey | null>(null);
  const opening = initialStat && options.includes(initialStat) ? initialStat : options[0];
  const stat = picked && options.includes(picked) ? picked : opening;

  const series = useMemo((): CumulativeSeries[] => {
    if (!stat) return [];
    const curves = chosenCurves(seasonCurves(data.games, stat)).map((c) => ({
      key: `y${c.year}`,
      label: CURVE_LABEL[c.key](c.year),
      points: c.points,
    }));
    const record = data.records.find((r) => r.statKey === stat);
    if (curves.length === 0 || !record || record.year === data.live?.year) return curves;
    const label = `Record pace${record.year ? ` (${record.year})` : ""}`;
    return [
      ...curves,
      { key: "record", label, points: recordPace(record.value, data.gamesPerSeason), reference: true },
    ];
  }, [data, stat]);

  if (!stat) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="No seasons to chart"
        description="Trends build up from committed box scores and imported seasons."
      />
    );
  }
  const format = formatter(stat);
  const { label } = getStat(stat);
  const points = data.seasons.map((s) => ({
    key: String(s.year),
    label: String(s.year),
    group: String(s.year),
    value: yearOverYear([s], stat)[0]?.value ?? 0,
  }));
  const rolling = rollingAverage(data.games, stat);
  const picker = (
    <Select
      className="w-56 max-w-full"
      aria-label="Stat to chart"
      value={stat}
      onValueChange={(key) => setPicked(key as StatKey)}
      options={options.map((key) => ({ value: key, label: getStat(key).label }))}
    />
  );

  return (
    <div className="space-y-8">
      <Section id={anchors?.trends} title="Trends" actions={picker}>
        <div className="space-y-3">
          {points.length > 1 && (
            <div className="rounded-xl border border-border bg-surface p-3">
              <TrendChart points={points} valueLabel={label} scale="auto" format={format} />
            </div>
          )}
          <YearTable stat={stat} data={data} />
        </div>
      </Section>
      <Section
        id={anchors?.cumulative}
        title="Cumulative"
        description="Regular season, franchise games only: each season from its first game."
      >
        {series.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Running totals start with the first committed box score.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <CumulativeChart
                series={series}
                valueLabel={label}
                format={format}
                marks={MARKS[stat as MarkStat] ?? []}
              />
            </div>
            {rolling.length > 1 && (
              <div className="rounded-xl border border-border bg-surface p-3">
                <h4 className="mb-2 text-xs font-medium text-muted-foreground">
                  {label}, average of the last {ROLLING_WINDOW} games
                </h4>
                <TrendChart points={rolling} valueLabel={`${label} average`} scale="auto" format={format} />
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
