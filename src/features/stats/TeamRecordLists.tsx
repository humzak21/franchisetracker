import { Shield } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { playPeriodLabel } from "@shared/games/scoringPlay";
import {
  RECORD_SCOPE_LABELS,
  TEAM_RECORD_SCOPES,
  TEAM_RECORD_STATS,
  type TeamRecordScope,
  type TeamRecordStat,
} from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { RankedList } from "@/components/data/RankedList";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import type { Split } from "./split";

/** The team's best and worst games and seasons (STATS-HUB.md 4.7), franchise games only. */
export function TeamRecordLists({ split }: { split: Split }) {
  const [scope, setScope] = useState<TeamRecordScope>("game");
  const lists = useQuery(api.stats.teamRecords.lists, { split, scope });
  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        aria-label="Scope"
        value={scope}
        onChange={setScope}
        options={TEAM_RECORD_SCOPES.map((s) => ({ value: s, label: RECORD_SCOPE_LABELS[s] }))}
      />
      <Notice icon={Shield}>
        The seasons you have played, from their scores and team stats. A game with no team stats captured
        stays off the lists that need them.
      </Notice>
      {lists === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No team records yet"
          description="These fill in from committed games. Older seasons need Rebuild stats in Settings → Data."
        />
      ) : (
        <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {lists.map((list) => {
            const { label } = TEAM_RECORD_STATS[list.statKey as TeamRecordStat];
            return (
              <RankedList
                key={list.statKey}
                title={label}
                label={`${label} team records`}
                items={list.entries.map((e, i) => ({
                  key: `${e.gameId ?? e.year}-${i}`,
                  rank: e.rank,
                  name: e.opponent ? `vs ${e.opponent.abbr}` : String(e.year),
                  gameId: e.gameId ?? undefined,
                  detail: e.weekKey ? (
                    <span className="num">
                      {[e.year, weekLabel(e.weekKey), e.period ? playPeriodLabel(e.period) : null]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  ) : undefined,
                  value: e.value,
                }))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
