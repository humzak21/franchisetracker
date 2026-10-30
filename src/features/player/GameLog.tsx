import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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
import { useFranchise } from "@/app/franchise";
import { DataTable, statColumn, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { TeamChip } from "@/components/team/TeamChip";
import { ResultBadge } from "@/components/team/ResultBadge";
import { Badge } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { phonePrimary } from "./careerStats";
import type { PlayerPage } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

type Row = FunctionReturnType<typeof api.players.gameLog.bySeason>[number];

function columns(
  position: Position,
  rows: readonly Row[],
  thresholds: ThresholdOverrides | undefined,
): { cols: DataColumn<Row>[]; primary: string[] } {
  // The position's main stats lead (a receiver's catches, a back's carries), fantasy right after.
  const stats = statsWithData(
    categoriesForPosition(positionGroupOf(position), [...RAW_STAT_CATEGORIES, "fantasy"]),
    rows.map((r) => ({ line: r.stats as StatLine })),
    { singleGame: true },
  );
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
      value: (r) => gameHighlights(r.stats as StatLine).length + r.touchdowns.length,
      cell: (r) => (
        <span className="flex flex-wrap gap-1">
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
  return { cols, primary: ["result", ...phonePrimary(position, stats).slice(0, 2)] };
}

/** Game by game for one franchise season, with threshold marks; seasons come from the player's logs. */
export function GameLog({ page }: { page: PlayerPage }) {
  const seasons = useMemo(() => {
    const logged = page.seasons.filter((s) => s.stats.source === "logs");
    const byId = new Map(logged.map((s) => [s.stats.seasonId, s.year]));
    return [...byId.entries()].sort((a, b) => b[1] - a[1]);
  }, [page.seasons]);
  const [picked, setPicked] = useState<Id<"seasons"> | null>(null);
  const seasonId = picked ?? seasons[0]?.[0] ?? null;
  const rows = useQuery(
    api.players.gameLog.bySeason,
    seasonId ? { playerId: page.player._id, seasonId } : "skip",
  );
  const setStat = useMutation(api.games.statLines.setStat);
  const position = page.history[page.history.length - 1]?.entry.position ?? page.player.position;
  const thresholds = useFranchise()?.franchise.settings.gameThresholdOverrides as
    ThresholdOverrides | undefined;
  const { cols, primary } = useMemo(
    () => columns(position, rows ?? [], thresholds),
    [position, rows, thresholds],
  );

  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No games logged yet"
        description="Game logs come from box scores you capture during the franchise; real seasons before it are season totals only."
      />
    );
  }
  return (
    <div className="space-y-3">
      {seasons.length > 1 && (
        <Select
          className="max-w-40"
          aria-label="Season"
          value={seasonId ?? ""}
          onValueChange={(id) => setPicked(id as Id<"seasons">)}
          options={seasons.map(([id, year]) => ({ value: id, label: String(year) }))}
        />
      )}
      <DataTable<Row>
        key={seasonId}
        id={`player-game-log-${positionGroupOf(position)}`}
        data={rows}
        columns={cols}
        getRowId={(r) => r.gameId}
        identityColumn="week"
        primaryColumns={primary}
        caption="Game log"
        onEdit={(row, statKey, value) =>
          setStat({
            gameId: row.gameId,
            playerId: page.player._id,
            statKey,
            value: typeof value === "string" ? Number(value) : value,
          })
        }
      />
    </div>
  );
}
