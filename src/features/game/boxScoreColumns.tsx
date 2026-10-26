/** Rows and registry-driven columns for one category of a game's box score. */
import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import {
  aggregateLines,
  gameHighlights,
  STAT_REGISTRY,
  statValue,
  type StatKey,
  type StatLine,
} from "@shared/stats";
import { statColumn, type DataColumn } from "@/components/data/DataTable";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Badge } from "@/components/ui/misc";

export type BoxTeam = FunctionReturnType<typeof api.games.boxScore.get>["teams"][number];

export type BoxRow = {
  id: string;
  playerId: string | null;
  name: string;
  position: string | null;
  jersey: number | null;
  line: StatLine;
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
    line: aggregateLines(rows.map((r) => r.line)),
  };
}

/** The player column carries the game's threshold highlights (300-yard passer, 2 sacks) as badges. */
export function boxColumns(stats: readonly StatKey[], team: TeamLike): DataColumn<BoxRow>[] {
  const player: DataColumn<BoxRow> = {
    id: "player",
    header: "Player",
    value: (r) => r.name,
    sortable: false,
    minWidth: 170,
    cell: (r) => {
      if (r.id === "totals") return <span className="font-semibold">Team</span>;
      const chip = (
        <PlayerChip
          size="sm"
          player={{ displayName: r.name, position: r.position ?? "", jersey: r.jersey, team }}
          showPosition={r.position !== null}
        />
      );
      const marks = gameHighlights(r.line);
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          {r.playerId ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: r.playerId }}
              className="min-w-0 hover:underline"
            >
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
  // Per-game cells skip season elite tiers; threshold badges mark the big games instead.
  return [
    player,
    ...stats.map((key) => statColumn<BoxRow>(key, (r) => statValue(key, r.line), { highlight: false })),
  ];
}
