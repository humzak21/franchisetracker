/** Builds the career stats table (rows, totals, registry-driven columns) for one player. */
import { positionGroupOf, type Position, type PositionGroup } from "@shared/domain";
import {
  aggregateLines,
  CATEGORY_GROUPS,
  STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsInCategory,
  statValue,
  type StatKey,
  type StatLine,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { StatCell } from "@/components/data/StatCell";
import type { PlayerPage } from "./types";

export type CareerRow = { id: string; year: number | null; teamAbbr: string; games: number; line: StatLine };

/** One row per season (log-derived totals win over imported ones), regular season only. */
export function careerRows(seasons: PlayerPage["seasons"]): CareerRow[] {
  const byKey = new Map<string, PlayerPage["seasons"][number]>();
  for (const s of seasons) {
    if (s.stats.split !== "regular") continue;
    const key = `${s.year}-${s.team._id}`;
    const existing = byKey.get(key);
    if (!existing || (existing.stats.source === "import" && s.stats.source === "logs")) byKey.set(key, s);
  }
  return [...byKey.values()].map((s) => ({
    id: `${s.year}-${s.team.abbr}`,
    year: s.year,
    teamAbbr: s.team.abbr,
    games: s.stats.gamesPlayed,
    line: s.stats.totals as StatLine,
  }));
}

export function totalsRow(rows: readonly CareerRow[]): CareerRow {
  return {
    id: "totals",
    year: null,
    teamAbbr: "",
    games: rows.reduce((n, r) => n + r.games, 0),
    line: aggregateLines(rows.map((r) => r.line)),
  };
}

const hasValue = (rows: readonly CareerRow[], key: StatKey) =>
  rows.some((r) => {
    const v = statValue(key, r.line, { games: r.games });
    return v !== null && v !== 0;
  });

/**
 * Stats worth a column: recorded raw stats, plus derived stats whose inputs were all recorded.
 * Categories for the player's own position group come first.
 */
export function visibleStats(position: Position, rows: readonly CareerRow[]): StatKey[] {
  const group = positionGroupOf(position);
  const own = STAT_CATEGORIES.filter((c) => CATEGORY_GROUPS[c].includes(group));
  const rest = STAT_CATEGORIES.filter((c) => !own.includes(c));
  return [...own, ...rest].flatMap((category) =>
    statsInCategory(category).filter((key) => {
      const def = STAT_REGISTRY[key];
      return def.kind === "raw" ? hasValue(rows, key) : def.dependsOn.every((dep) => hasValue(rows, dep));
    }),
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
export function careerColumns(stats: readonly StatKey[]): DataColumn<CareerRow>[] {
  const season: DataColumn<CareerRow> = {
    id: "season",
    header: "Season",
    value: (r) => r.year ?? Number.MAX_SAFE_INTEGER,
    cell: (r) =>
      r.year === null ? (
        <span className="font-semibold">Career</span>
      ) : (
        <span className="num font-medium">
          {r.year} <span className="text-xs text-subtle-foreground">{r.teamAbbr}</span>
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
      cell: (r: CareerRow) => <StatCell stat={key} value={value(r)} highlight={r.year !== null} />,
    };
  });
  return [season, games, ...statCols];
}
