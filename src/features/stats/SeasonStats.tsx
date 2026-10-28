import { BarChart3, History } from "lucide-react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { STAT_GROUPS, statGroup, type ThresholdOverrides } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { seasonColumns } from "./seasonColumns";
import { groupRows, totalsRow } from "./seasonRows";
import type { Split } from "./split";
import { useQuery } from "@/lib/convex/useQuery";

/** Season stats by position group (FEATURES.md 5.5): registry columns, big-game counts, season highs, totals. */
export function SeasonStats({ split }: { split: Split }) {
  const { season } = useSeason();
  const active = useFranchise();
  const data = useQuery(api.stats.season.bySplit, season ? { seasonId: season._id, split } : "skip");
  const [groupId, setGroupId] = useLocalStorage("ft.stats-group", STAT_GROUPS[0]!.id);
  const group = statGroup(groupId);
  const thresholds = active?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;

  const table = useMemo(() => {
    if (!data || !active) return undefined;
    const rows = groupRows(data, group);
    return { rows, totals: totalsRow(rows), ...seasonColumns(group, rows, active.userTeam, thresholds) };
  }, [data, active, group, thresholds]);

  const preFranchise = season && active && isPreFranchise(season.year, active.franchise.startYear);
  return (
    <div className="space-y-3">
      {preFranchise && (
        <Notice icon={History}>
          {season.year} is real NFL history: season totals for the {active.userTeam.name} imported from
          nflverse. Records, leaders and streaks count only the seasons you play.
        </Notice>
      )}
      <div data-swipe-ignore className="-mx-1 scrollbar-none overflow-x-auto px-1">
        <Segmented
          size="sm"
          aria-label="Position group"
          value={group.id}
          onChange={setGroupId}
          options={STAT_GROUPS.map((g) => ({ value: g.id, label: g.label }))}
        />
      </div>
      {!table ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <DataTable
          key={`${group.id}-${split}`}
          id={`season-${group.id}`}
          caption={`${group.label} season stats`}
          data={table.rows}
          columns={table.columns}
          getRowId={(r) => r.id}
          identityColumn="player"
          primaryColumns={group.phone.filter((k) => table.stats.includes(k))}
          totals={table.rows.length > 1 ? table.totals : undefined}
          initialSort={
            table.stats.includes(group.lead)
              ? { id: group.lead, desc: true }
              : table.stats[0]
                ? { id: table.stats[0], desc: true }
                : undefined
          }
          searchable
          searchPlaceholder="Find a player"
          emptyState={
            <EmptyState
              icon={BarChart3}
              title={split === "postseason" ? "No playoff stats" : "No stats yet"}
              description="Season stats add up from the box scores you commit, game by game."
            />
          }
        />
      )}
      {table?.rows.some((r) => r.overridden.length > 0) && (
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">•</span> {MISSING_GAME_NOTE}.
        </p>
      )}
    </div>
  );
}
