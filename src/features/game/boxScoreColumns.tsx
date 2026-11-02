/** Rows and registry-driven columns for one category of a game's box score. */
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { teamDefenseLine, teamDefenseName } from "@shared/games/starLine";
import {
  aggregateLines,
  gameHighlights,
  STAT_REGISTRY,
  statValue,
  type StatKey,
  type StatLine,
  type ThresholdOverrides,
} from "@shared/stats";
import { editableStat, statColumn, type DataColumn } from "@/components/data/DataTable";
import { StatCell } from "@/components/data/StatCell";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamLogo, type TeamLike } from "@/components/team/TeamLogo";
import { Badge } from "@/components/ui/misc";
import { StarToggle } from "./StarToggle";

export type BoxTeam = FunctionReturnType<typeof api.games.boxScore.get>["teams"][number];

export type BoxRow = {
  id: string;
  playerId: string | null;
  name: string;
  position: string | null;
  jersey: number | null;
  headshotUrl: string | null;
  line: StatLine;
  /** The row is the team's whole defense rather than one player. */
  teamDefense?: boolean;
};

/** Players with at least one of these stats, best first by the category's lead stat. */
export function boxRows(team: BoxTeam, stats: readonly StatKey[]): BoxRow[] {
  const lead = stats[0];
  return team.lines
    .map((l) => ({
      id: l.playerId,
      playerId: l.playerId,
      name: l.name,
      position: l.position,
      jersey: l.jersey,
      headshotUrl: l.headshotUrl,
      line: l.stats as StatLine,
    }))
    .filter((r) => stats.some((k) => STAT_REGISTRY[k].kind === "raw" && (statValue(k, r.line) ?? 0) !== 0))
    .sort((a, b) => (lead ? (statValue(lead, b.line) ?? 0) - (statValue(lead, a.line) ?? 0) : 0));
}

export function totalsRow(rows: readonly BoxRow[]): BoxRow {
  return {
    id: "totals",
    playerId: null,
    name: "Team",
    position: null,
    jersey: null,
    headshotUrl: null,
    line: aggregateLines(rows.map((r) => r.line)),
  };
}

/** The row id of a team's cumulative defense. */
export const defenseRowId = (teamId: string) => `defense-${teamId}`;

/**
 * The whole defense as one row, held above its players: every defensive stat added up, so it can
 * be a star when the defense played great and no single player did.
 */
export function defenseRow({ team, lines }: BoxTeam): BoxRow {
  return {
    id: defenseRowId(team._id),
    playerId: null,
    name: teamDefenseName(team.abbr),
    position: null,
    jersey: null,
    headshotUrl: null,
    line: teamDefenseLine(lines.map((l) => l.stats as StatLine)),
    teamDefense: true,
  };
}

/** Which box score rows are stars of the game, by row id, and the one-click toggle. */
export type BoxStars = {
  isStar: (rowId: string) => boolean;
  /** The row being starred or unstarred right now. */
  pending: string | null;
  toggle: (row: BoxRow) => void;
};

/**
 * The player column carries the one-click star and the game's threshold highlights (300-yard
 * passer, 2 sacks) as badges. A defense's row gets the star and the team's logo, no highlights.
 */
export function boxColumns(
  stats: readonly StatKey[],
  team: TeamLike,
  stars: BoxStars,
  thresholds: ThresholdOverrides | undefined,
): DataColumn<BoxRow>[] {
  const player: DataColumn<BoxRow> = {
    id: "player",
    header: "Player",
    value: (r) => r.name,
    sortable: false,
    minWidth: 200,
    cell: (r) => {
      if (r.id === "totals") return <span className="font-semibold">Team</span>;
      const chip = (
        <PlayerChip
          size="sm"
          avatar={r.teamDefense ? <TeamLogo team={team} size="xs" /> : undefined}
          player={{
            displayName: r.name,
            position: r.position ?? "",
            jersey: r.jersey,
            headshotUrl: r.headshotUrl,
            team,
          }}
          showPosition={r.position !== null}
        />
      );
      const marks = r.teamDefense ? [] : gameHighlights(r.line);
      const playerId = r.playerId;
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <StarToggle
            name={r.name}
            starred={stars.isStar(r.id)}
            busy={stars.pending === r.id}
            onToggle={() => stars.toggle(r)}
          />
          {playerId ? (
            <Link to="/players/$playerId" params={{ playerId }} className="min-w-0 hover:underline">
              {chip}
            </Link>
          ) : (
            chip
          )}
          {marks.map((m) => (
            <Badge key={m.key} tone="accent" title={m.label} className="shrink-0">
              {m.short}
            </Badge>
          ))}
        </span>
      );
    },
  };
  // Player cells use the single-game tiers (300 passing yards, 500 for the big highlight); the
  // team totals and a defense's row are sums, not one player's game, so they stay plain.
  // Recorded stats edit in place; rates (CMP%, AVG) are worked out from them.
  return [
    player,
    ...stats.map((key) => {
      const value = (r: BoxRow) => statValue(key, r.line);
      const column = statColumn<BoxRow>(key, value, { highlight: "game", thresholds });
      return editableStat(
        {
          ...column,
          cell: (r) => (r.playerId === null ? <StatCell stat={key} value={value(r)} /> : column.cell?.(r)),
        },
        key,
        (r) => r.line,
      );
    }),
  ];
}
