import { Gauge } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import {
  MARK_HORIZON_LABELS,
  MARK_HORIZONS,
  markLabel,
  type MarkHorizon,
  type MarkStat,
} from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { RankedList } from "@/components/data/RankedList";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { MARK_STAT_OPTIONS } from "./markOptions";

/** Fastest to a mark (STATS-HUB.md 4.2): one list per mark of a stat, fewest games first. */
export function FastestToLists() {
  const [statKey, setStatKey] = useLocalStorage<MarkStat>("ft.fastest-stat", "rushYds");
  const [horizon, setHorizon] = useLocalStorage<MarkHorizon>("ft.fastest-horizon", "season");
  const lists = useQuery(api.stats.marks.lists, { statKey, horizon });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="w-56 max-w-full"
          aria-label="Stat"
          value={statKey}
          options={MARK_STAT_OPTIONS}
          onValueChange={(value) => setStatKey(value as MarkStat)}
        />
        <Segmented
          size="sm"
          aria-label="Counted over"
          value={horizon}
          onChange={setHorizon}
          options={MARK_HORIZONS.map((h) => ({ value: h, label: MARK_HORIZON_LABELS[h] }))}
        />
      </div>
      <Notice icon={Gauge}>
        Regular-season games with the team. A real veteran&apos;s earlier seasons count towards his total and
        his games, so a mark they already passed has no game to name and is left off.
      </Notice>
      {lists === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nobody has reached a mark yet"
          description="These fill in from committed box scores."
        />
      ) : (
        <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {lists.map((list) => {
            const title = markLabel({ statKey, mark: list.mark });
            return (
              <RankedList
                key={list.mark}
                title={title}
                label={`Fastest to ${title}`}
                items={list.entries.map((e) => ({
                  key: `${e.player.playerId}-${e.year}`,
                  rank: e.rank,
                  name: e.player.name,
                  playerId: e.player.playerId,
                  detail: <span className="num">{`${e.year} ${weekLabel(e.weekKey)}`}</span>,
                  gameId: e.gameId,
                  value: `${e.gamesToReach} games`,
                }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
