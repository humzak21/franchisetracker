/** Builds the career stats table (rows, totals, registry-driven columns) for one player. */
import { positionGroupOf, type Position, type PositionGroup } from "@shared/domain";
import {
  aggregateLines,
  CATEGORY_GROUPS,
  preferLogs,
  RAW_STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatKey,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { StatCell } from "@/components/data/StatCell";
import type { PlayerPage } from "./types";

export type CareerRow = {
  id: string;
  year: number | null;
  teamAbbr: string;
  games: number;
  line: StatLine;
  /** Imported real-NFL totals from before the franchise, not derived from captured games. */
  imported: boolean;
  /** Stats showing the season screen's number (see `withMissingGames`). */
  overridden: readonly string[];
};

/** One row per season (log-derived totals win over imported ones) for the regular season or playoffs. */
export function careerRows(
  seasons: PlayerPage["seasons"],
  split: "regular" | "postseason" = "regular",
): CareerRow[] {
  const regular = seasons
    .filter((s) => s.stats.split === split)
    .map((s) => ({ ...s, teamKey: s.team._id, source: s.stats.source }));
  return preferLogs(regular).map((s) => ({
    id: `${s.year}-${s.team.abbr}`,
    year: s.year,
    teamAbbr: s.team.abbr,
    games: s.stats.gamesPlayed,
    line: s.stats.totals as StatLine,
    imported: s.stats.source === "import",
    overridden: s.overridden,
  }));
}

export function totalsRow(rows: readonly CareerRow[]): CareerRow {
  return {
    id: "totals",
    year: null,
    teamAbbr: "",
    games: rows.reduce((n, r) => n + r.games, 0),
    line: aggregateLines(rows.map((r) => r.line)),
    imported: false,
    overridden: [],
  };
}

/**
 * Stats worth a column: recorded raw stats, plus derived stats whose inputs were all recorded.
 * Categories for the player's own position group come first; fantasy points close the row.
 */
export function visibleStats(position: Position, rows: readonly CareerRow[]): StatKey[] {
  const group = positionGroupOf(position);
  const own = RAW_STAT_CATEGORIES.filter((c) => CATEGORY_GROUPS[c].includes(group));
  const rest = RAW_STAT_CATEGORIES.filter((c) => !own.includes(c));
  return statsWithData(
    [...own, ...rest, "fantasy"],
    rows.map((r) => ({ line: r.line, games: r.games })),
  );
}

const PHONE_PRIMARY: Partial<Record<PositionGroup, StatKey[]>> = {
  QB: ["passYds", "passTd", "passInt", "passRating"],
  RB: ["rushYds", "rushTd", "rushAvg"],
  WR: ["rec", "recYds", "recTd"],
  TE: ["rec", "recYds", "recTd"],
  DL: ["tackles", "sacks", "tacklesForLoss"],
  LB: ["tackles", "sacks", "defInt"],
  DB: ["tackles", "defInt", "passDeflections"],
  K: ["fgm", "fga", "fgPct"],
  P: ["punts", "puntAvg"],
};

export function phonePrimary(position: Position, stats: readonly StatKey[]): string[] {
  const preferred = PHONE_PRIMARY[positionGroupOf(position)] ?? [];
  const chosen = preferred.filter((k) => stats.includes(k));
  return chosen.length > 0 ? chosen : stats.slice(0, 3);
}

/** Season label column plus one registry column per stat. Season rows get elite highlights; totals don't. */
export function careerColumns(
  stats: readonly StatKey[],
  thresholds?: ThresholdOverrides,
): DataColumn<CareerRow>[] {
  const season: DataColumn<CareerRow> = {
    id: "season",
    header: "Season",
    value: (r) => r.year ?? Number.MAX_SAFE_INTEGER,
    cell: (r) =>
      r.year === null ? (
        <span className="font-semibold">Career</span>
      ) : (
        <span className="num inline-flex items-center gap-1.5 font-medium">
          {r.year} <span className="text-xs text-subtle-foreground">{r.teamAbbr}</span>
          {r.imported && (
            <span
              title="Real NFL season before the franchise"
              className="rounded border border-dashed border-border-strong px-1 text-[10px] leading-4 font-semibold text-muted-foreground"
            >
              NFL
            </span>
          )}
        </span>
      ),
  };
  const games: DataColumn<CareerRow> = {
    id: "gp",
    header: "GP",
    title: "Games played",
    align: "right",
    sortDescFirst: true,
    value: (r) => r.games,
  };
  const statCols = stats.map((key) => {
    const value = (r: CareerRow) => statValue(key, r.line, { games: r.games });
    return {
      ...statColumn<CareerRow>(key, value, { group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category] }),
      cell: (r: CareerRow) => (
        <StatCell
          stat={key}
          value={value(r)}
          highlight={r.year !== null}
          thresholds={thresholds}
          note={r.overridden.includes(key) ? MISSING_GAME_NOTE : undefined}
        />
      ),
    };
  });
  return [season, games, ...statCols];
}
