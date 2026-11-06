import { useState } from "react";
import {
  formatStat,
  formatValue,
  gameByGame,
  getStat,
  inRange,
  summarize,
  type GamePoint,
  type GameRange,
  type LoggedGame,
  type StatKey,
} from "@shared/stats";
import { Tile, TileStrip } from "@/components/data/Tile";
import { TrendChart } from "@/components/data/TrendChart";
import { Section } from "@/components/layout/Section";
import { GameRangePicker } from "./GameRangePicker";

/** A spread or an average reads to one decimal whatever the stat's own format. */
const decimal = (value: number) => formatValue(value, "decimal");

function rangeLabel(range: GameRange, shown: readonly GamePoint[]): string {
  if (range.kind === "all") return "every game";
  if (range.kind === "season") return `${range.year} season`;
  const first = shown[0];
  const last = shown.at(-1);
  if (!first || !last || first.key === last.key) return first?.label ?? "";
  // One season says its year once: "2026 · Week 1 to Week 9".
  return first.year === last.year ? `${first.label} to ${last.week}` : `${first.label} to ${last.label}`;
}

/**
 * A stat in every game logged in the franchise, playoffs included, or in a season or span of
 * weeks, and what those games add up to: average, median, mode, spread, high, low and total.
 */
export function GameByGame({
  id,
  games,
  stat,
  className,
}: {
  id?: string;
  games: readonly LoggedGame[];
  stat: StatKey;
  className?: string;
}) {
  const [range, setRange] = useState<GameRange>({ kind: "all" });
  const points = gameByGame(games, stat);
  const shown = inRange(points, range);
  const summary = summarize(shown.map((p) => p.value));
  const { label } = getStat(stat);
  const format = (value: number) => formatStat(stat, value);
  const span = rangeLabel(range, shown);

  return (
    <Section
      id={id}
      className={className}
      title="By game"
      description="Every game logged in the franchise, playoffs included."
      actions={points.length > 0 && <GameRangePicker points={points} range={range} onChange={setRange} />}
    >
      {!summary ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Games show up here with the first committed box score.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border border-border bg-surface p-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              {label}, {span} · <span className="num">{summary.count}</span>{" "}
              {summary.count === 1 ? "game" : "games"}
            </h3>
            {shown.length > 1 ? (
              <TrendChart points={shown} valueLabel={label} scale="auto" format={format} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                One game in this range: widen it to draw a line.
              </p>
            )}
          </div>
          <TileStrip>
            <Tile label="Average" value={decimal(summary.mean)} accent detail="per game" />
            <Tile label="Median" value={decimal(summary.median)} detail="middle game" />
            <Tile
              label="Mode"
              value={summary.mode === null ? "—" : format(summary.mode)}
              detail={summary.mode === null ? "no repeats" : `${summary.modeCount} games`}
            />
            <Tile label="Std dev" value={decimal(summary.stdDev)} detail="game to game" />
            <Tile label="High" value={format(summary.max)} detail={shown[summary.maxAt]?.label} />
            <Tile label="Low" value={format(summary.min)} detail={shown[summary.minAt]?.label} />
            <Tile label="Total" value={format(summary.total)} detail={span} />
            <Tile label="Games" value={summary.count} detail={`from ${shown[0]?.label ?? ""}`} />
          </TileStrip>
        </div>
      )}
    </Section>
  );
}
