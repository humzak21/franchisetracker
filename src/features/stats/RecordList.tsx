import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Pencil } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { formatStat, isStatKey, STAT_REGISTRY } from "@shared/stats";
import { RankedList } from "@/components/data/RankedList";
import { TeamLogo } from "@/components/team/TeamLogo";

export type RecordListView = FunctionReturnType<typeof api.stats.records.lists>["lists"][number];
export type RecordEntry = RecordListView["entries"][number];

const format = (statKey: string, value: number) =>
  isStatKey(statKey) ? formatStat(statKey, value) : String(value);

const when = (e: RecordEntry) =>
  e.firstYear !== null && e.year !== null && e.firstYear !== e.year
    ? `${e.firstYear}–${e.year}`
    : (e.year ?? "");

/**
 * One records list (FEATURES.md 5.5): the top twenty with player, number, team and year, the
 * record itself lit. A single-game entry links to its game; typed entries open for editing.
 */
export function RecordList({
  list,
  onEditTyped,
}: {
  list: RecordListView;
  onEditTyped?: (entry: RecordEntry) => void;
}) {
  const label = isStatKey(list.statKey) ? STAT_REGISTRY[list.statKey].label : list.statKey;
  return (
    <RankedList
      title={label}
      label={`${label} records`}
      items={list.entries.map((e, i) => ({
        key: `${e.player?.playerId ?? e.typedId ?? e.name}-${e.year ?? i}-${e.weekKey ?? ""}`,
        rank: e.rank,
        name: e.name,
        playerId: e.player?.playerId,
        nameEnd: e.typedId && onEditTyped && (
          <button
            type="button"
            aria-label={`Edit ${e.name}'s typed record`}
            onClick={() => onEditTyped(e)}
            className="shrink-0 rounded text-subtle-foreground hover:text-foreground pointer-coarse:touch-target"
          >
            <Pencil className="size-3.5" />
          </button>
        ),
        gameId: e.gameId ?? undefined,
        detail: (
          <>
            {e.team && <TeamLogo team={e.team} size="xs" />}
            {e.team && <span>{e.team.abbr}</span>}
            <span className="num">
              {when(e)}
              {e.weekKey ? ` ${weekLabel(e.weekKey)}` : ""}
            </span>
          </>
        ),
        value: format(list.statKey, e.value),
      }))}
      footer={
        (list.game || list.previous) && (
          <>
            {list.game && (
              <Link to="/games/$gameId" params={{ gameId: list.game._id }} className="hover:underline">
                Set {list.entries[0]?.year ? `${list.entries[0].year} ` : ""}
                {weekLabel(list.game.weekKey)}
                {list.game.opponentAbbr ? ` vs ${list.game.opponentAbbr}` : ""}
              </Link>
            )}
            {list.game && list.previous && " · "}
            {list.previous &&
              `Broke ${list.previous.name}'s ${format(list.statKey, list.previous.value)}${list.previous.year ? ` (${list.previous.year})` : ""}`}
          </>
        )
      }
    />
  );
}
