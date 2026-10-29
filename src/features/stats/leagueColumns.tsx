/** Registry-driven columns for one position group of the league stats table. */
import { Link } from "@tanstack/react-router";
import {
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  statsWithData,
  statValue,
  type StatGroup,
  type StatKey,
  type ThresholdOverrides,
} from "@shared/stats";
import { editableStat, statColumn, type DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamChip } from "@/components/team/TeamChip";
import type { LeagueRow } from "./leagueRows";

export function leagueColumns(
  group: StatGroup,
  rows: readonly LeagueRow[],
  thresholds: ThresholdOverrides | undefined,
): { columns: DataColumn<LeagueRow>[]; stats: StatKey[] } {
  const stats = statsWithData(
    group.categories,
    rows.map((r) => ({ line: r.line, games: r.games })),
  );
  const player: DataColumn<LeagueRow> = {
    id: "player",
    header: "Player",
    value: (r) => r.name,
    searchable: true,
    sortable: false,
    minWidth: 170,
    cell: (r) => (
      <Link to="/players/$playerId" params={{ playerId: r.playerId }} className="hover:underline">
        <PlayerChip
          size="sm"
          player={{
            displayName: r.name,
            position: r.position,
            headshotUrl: r.headshotUrl,
            team: r.team ?? undefined,
          }}
        />
      </Link>
    ),
  };
  const team: DataColumn<LeagueRow> = {
    id: "team",
    header: "Team",
    value: (r) => r.team?.abbr ?? null,
    searchable: true,
    cell: (r) =>
      r.team ? (
        <TeamChip
          team={r.team}
          label="abbr"
          size="xs"
          className={r.isUser ? "text-primary" : "text-muted-foreground"}
        />
      ) : null,
  };
  const games: DataColumn<LeagueRow> = {
    id: "gp",
    header: "GP",
    title: "Games played",
    align: "right",
    sortDescFirst: true,
    value: (r) => r.games,
    edit: { kind: "number", get: (r) => r.games, min: 0, max: 25 },
  };
  const statCols = stats.map((key) =>
    editableStat(
      statColumn<LeagueRow>(key, (r) => statValue(key, r.line, { games: r.games || 1 }), {
        group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
        thresholds,
      }),
      key,
      (r) => r.line,
    ),
  );
  return { columns: [player, team, games, ...statCols], stats };
}
