import { useMemo, useState } from "react";
import {
  chosenCurves,
  formatStat,
  getStat,
  MARKS,
  recordPace,
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
import { EmptyState } from "@/components/data/EmptyState";
import { TrendChart } from "@/components/data/TrendChart";
import { Section } from "@/components/layout/Section";
import { STICKY_TOP, type StickyBelow } from "@/components/layout/sticky";
import { StepSelect } from "@/components/ui/StepSelect";
import { cn } from "@/lib/cn";
import { LineChart as LineChartIcon } from "lucide-react";
import { CareerYearTable } from "./CareerYearTable";
import { GameByGame } from "./GameByGame";

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

/** Jumping to a section lands below the header, the jump links and the stat bar. */
const BELOW_BAR = "scroll-mt-48";

/**
 * A career as curves, for the player page and Stats → Trends: a stat season by season with each
 * change, each season's running total against the last, the best and the franchise record, and
 * every game one by one. Imported seasons have no games, so curves start at the franchise. The stat
 * picker sticks to the top while any of the three is on screen, so changing it never means
 * scrolling back up.
 */
export function CareerCurves({
  data,
  initialStat,
  anchors,
  pinBelow = "header",
}: {
  data: CareerCurvesData;
  /** The stat to open on, usually the position's lead stat. */
  initialStat?: StatKey;
  /** Section ids for a page's jump links. */
  anchors?: { trends: string; cumulative: string; byGame: string };
  /** What the stat bar pins under: the page header, or the header and the page's jump links. */
  pinBelow?: StickyBelow;
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
  const format = (value: number) => formatStat(stat, value);
  const { label } = getStat(stat);
  const points = data.seasons.map((s) => ({
    key: String(s.year),
    label: String(s.year),
    group: String(s.year),
    value: yearOverYear([s], stat)[0]?.value ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "sticky z-10 flex items-center gap-2 rounded-xl border border-border-strong bg-surface p-1.5 shadow-lg",
          STICKY_TOP[pinBelow],
        )}
        data-swipe-ignore
      >
        <span className="hidden pl-2 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase @tablet:inline">
          Stat
        </span>
        <StepSelect
          className="flex-1 @tablet:max-w-sm"
          aria-label="Stat to chart"
          value={stat}
          onValueChange={(key) => setPicked(key as StatKey)}
          options={options.map((key) => ({ value: key, label: getStat(key).label }))}
        />
      </div>
      <Section id={anchors?.trends} className={BELOW_BAR} title="Trends">
        <div className="space-y-3">
          {points.length > 1 && (
            <div className="rounded-xl border border-border bg-surface p-3">
              <TrendChart points={points} valueLabel={label} scale="auto" format={format} />
            </div>
          )}
          <CareerYearTable stat={stat} data={data} />
        </div>
      </Section>
      <Section
        id={anchors?.cumulative}
        className={BELOW_BAR}
        title="Cumulative"
        description="Regular season, franchise games only: each season from its first game."
      >
        {series.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Running totals start with the first committed box score.
          </p>
        ) : (
          <div className="rounded-xl border border-border bg-surface p-3">
            <CumulativeChart
              series={series}
              valueLabel={label}
              format={format}
              marks={MARKS[stat as MarkStat] ?? []}
            />
          </div>
        )}
      </Section>
      <GameByGame id={anchors?.byGame} className={BELOW_BAR} games={data.games} stat={stat} />
    </div>
  );
}
