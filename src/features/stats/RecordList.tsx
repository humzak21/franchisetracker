import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { Pencil } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { formatStat, isStatKey, STAT_REGISTRY } from "@shared/stats";
import { TeamLogo } from "@/components/team/TeamLogo";
import { cn } from "@/lib/cn";

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
 * record itself lit. Typed entries open for editing.
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
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface"
      aria-label={`${label} records`}
    >
      <h4 className="border-b border-border px-4 py-2.5 text-sm font-medium">{label}</h4>
      <ol className="divide-y divide-border">
        {list.entries.map((e, i) => (
          <li
            key={`${e.player?.playerId ?? e.typedId ?? e.name}-${e.year ?? i}`}
            className="flex min-h-11 items-center gap-2.5 px-3 py-1.5"
          >
            <span
              className={cn(
                "num w-5 shrink-0 text-right font-display text-base font-bold",
                e.rank === 1 ? "text-primary" : "text-subtle-foreground",
              )}
            >
              {e.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-1.5 text-sm">
                {e.player ? (
                  <Link
                    to="/players/$playerId"
                    params={{ playerId: e.player.playerId }}
                    className="truncate hover:underline pointer-coarse:touch-target"
                  >
                    {e.name}
                  </Link>
                ) : (
                  <span className="truncate">{e.name}</span>
                )}
                {e.typedId && onEditTyped && (
                  <button
                    type="button"
                    aria-label={`Edit ${e.name}'s typed record`}
                    onClick={() => onEditTyped(e)}
                    className="shrink-0 rounded text-subtle-foreground hover:text-foreground pointer-coarse:touch-target"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {e.team && <TeamLogo team={e.team} size="xs" />}
                {e.team && <span>{e.team.abbr}</span>}
                <span className="num">{when(e)}</span>
              </span>
            </span>
            <span className={cn("num shrink-0 text-sm font-semibold", i === 0 && "text-primary")}>
              {format(list.statKey, e.value)}
            </span>
          </li>
        ))}
      </ol>
      {(list.game || list.previous) && (
        <p className="border-t border-border px-4 py-2 text-xs text-subtle-foreground">
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
        </p>
      )}
    </section>
  );
}
