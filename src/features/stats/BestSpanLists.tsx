import { CalendarRange } from "lucide-react";
import { api } from "@convex/_generated/api";
import { formatStat, type MarkStat } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { RankedList } from "@/components/data/RankedList";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { MARK_STAT_OPTIONS } from "./markOptions";
import type { Split } from "./split";

/** The best N games in a row (STATS-HUB.md 4.3): one list per window of a stat. */
export function BestSpanLists({ split }: { split: Split }) {
  const [statKey, setStatKey] = useLocalStorage<MarkStat>("ft.span-stat", "scrimmageTd");
  const lists = useQuery(api.stats.spans.lists, { split, statKey });
  return (
    <div className="space-y-4">
      <Select
        className="w-56 max-w-full"
        aria-label="Stat"
        value={statKey}
        options={MARK_STAT_OPTIONS}
        onValueChange={(value) => setStatKey(value as MarkStat)}
      />
      <Notice icon={CalendarRange}>
        Games with the team in a row, across seasons too. A game a player missed neither counts nor breaks a
        span.
      </Notice>
      {lists === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="No spans yet"
          description="These fill in from committed box scores."
        />
      ) : (
        <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {lists.map((list) => (
            <RankedList
              key={list.window}
              title={`Any ${list.window} games`}
              label={`Best ${list.window} games`}
              items={list.entries.map((e) => ({
                key: `${e.player.playerId}-${e.startGameId}`,
                rank: e.rank,
                name: e.player.name,
                playerId: e.player.playerId,
                detail: <span className="num truncate">{e.span}</span>,
                gameId: e.startGameId,
                value: formatStat(statKey, e.value),
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
