import {
  formatStat,
  formatValue,
  getStat,
  recentGames,
  RECENT_GAMES,
  summarize,
  type LoggedGame,
  type StatKey,
} from "@shared/stats";
import { Tile, TileStrip } from "@/components/data/Tile";
import { TrendChart } from "@/components/data/TrendChart";

/** A spread or an average reads to one decimal whatever the stat's own format. */
const decimal = (value: number) => formatValue(value, "decimal");

/**
 * A stat game by game over the player's last 30 games (or all of them, if fewer), then what those
 * games add up to: average, median, mode, spread, high, low and total.
 */
export function RecentGames({ games, stat }: { games: readonly LoggedGame[]; stat: StatKey }) {
  const points = recentGames(games, stat);
  const summary = summarize(points.map((p) => p.value));
  if (!summary) return null;
  const { label } = getStat(stat);
  const format = (value: number) => formatStat(stat, value);
  const span = summary.count === RECENT_GAMES ? `last ${RECENT_GAMES} games` : `all ${summary.count} games`;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border bg-surface p-3">
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">
          {label}, game by game, {span}
        </h4>
        {points.length > 1 ? (
          <TrendChart points={points} valueLabel={label} scale="auto" format={format} />
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            One game so far: the chart starts with the second.
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
        <Tile label="High" value={format(summary.max)} detail={points[summary.maxAt]?.label} />
        <Tile label="Low" value={format(summary.min)} detail={points[summary.minAt]?.label} />
        <Tile label="Total" value={format(summary.total)} detail={span} />
        <Tile label="Games" value={summary.count} detail={`since ${points[0]?.label ?? ""}`} />
      </TileStrip>
    </div>
  );
}
