/** The game log's columns: which stats a position shows, and the season column a career adds. */
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { positionGroupOf, SCORING_KIND_LABELS, weekIndex, weekLabel, type Position } from "@shared/domain";
import { playWhen } from "@shared/games/scoringPlay";
import {
  categoriesForPosition,
  gameHighlights,
  isRawStatKey,
  RAW_STAT_CATEGORIES,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { TeamChip } from "@/components/team/TeamChip";
import { ResultBadge } from "@/components/team/ResultBadge";
import { Badge } from "@/components/ui/misc";
import { phonePrimary } from "./careerStats";

export type GameLogRow = FunctionReturnType<typeof api.players.gameLog.bySeason>[number];
type Row = GameLogRow;

export function gameLogColumns(
  position: Position,
  rows: readonly Row[],
  thresholds: ThresholdOverrides | undefined,
  /** A career runs across seasons, so a week alone says nothing. */
  career: boolean,
): { cols: DataColumn<Row>[]; primary: string[] } {
  // The position's main stats lead (a receiver's catches, a back's carries), fantasy right after.
  const stats = statsWithData(
    categoriesForPosition(positionGroupOf(position), [...RAW_STAT_CATEGORIES, "fantasy"]),
    rows.map((r) => ({ line: r.stats as StatLine })),
    { singleGame: true },
  );
  const year: DataColumn<Row> = {
    id: "year",
    header: "Year",
    title: "Season",
    align: "right",
    value: (r) => r.year,
    cell: (r) => <span className="num">{r.year}</span>,
  };
  const cols: DataColumn<Row>[] = [
    {
      id: "week",
      header: "Wk",
      title: "Week",
      value: (r) => weekIndex(r.weekKey),
      cell: (r) => (
        <Link
          to="/games/$gameId"
          params={{ gameId: r.gameId }}
          className="num font-medium hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          {weekLabel(r.weekKey)}
        </Link>
      ),
    },
    ...(career ? [year] : []),
    {
      id: "opp",
      header: "Opp",
      title: "Opponent",
      value: (r) => r.opponent?.abbr,
      cell: (r) =>
        r.opponent ? (
          <span className="inline-flex items-center gap-1 text-sm">
            <span className="text-subtle-foreground">{r.home ? "vs" : "@"}</span>
            <TeamChip team={r.opponent} label="abbr" size="xs" />
          </span>
        ) : null,
    },
    {
      id: "result",
      header: "Result",
      value: (r) => (r.score ? r.score.us - r.score.them : null),
      cell: (r) => <ResultBadge result={r.result} us={r.score?.us ?? null} them={r.score?.them ?? null} />,
    },
    {
      id: "marks",
      header: "Marks",
      title: "Highlights",
      sortable: false,
      value: (r) => gameHighlights(r.stats as StatLine).length + r.touchdowns.length + r.marks.length,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
          {r.marks.map((mark) => (
            <Badge key={mark} tone="win" title="Mark reached in this game">
              {mark}
            </Badge>
          ))}
          {gameHighlights(r.stats as StatLine).map((t) => (
            <Badge key={t.key} tone="accent" title={t.label}>
              {t.short}
            </Badge>
          ))}
          {r.touchdowns.map((td) => (
            <Badge key={playWhen(td)} title={SCORING_KIND_LABELS[td.kind]}>
              TD {playWhen(td)}
            </Badge>
          ))}
        </span>
      ),
    },
    ...stats.map((key) => {
      const column = statColumn<Row>(key, (r) => statValue(key, r.stats as StatLine), {
        group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
        // Per-game cells use the single-game tiers, not the season ones.
        highlight: "game",
        thresholds,
      });
      // Recorded stats edit in place (the same save as the box score); rates are worked out.
      return isRawStatKey(key)
        ? { ...column, edit: { kind: "number" as const, get: (r: Row) => (r.stats as StatLine)[key] } }
        : column;
    }),
  ];
  return {
    cols,
    primary: [
      ...(career ? ["year"] : []),
      "result",
      ...phonePrimary(position, stats).slice(0, career ? 1 : 2),
    ],
  };
}
