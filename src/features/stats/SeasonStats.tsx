import { useMutation } from "convex/react";
import { BarChart3, History } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { GAMES_EDIT_KEY, STAT_GROUPS, type ThresholdOverrides } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { FindPlayer } from "./FindPlayer";
import { groupAnchor, GroupSection } from "./GroupSection";
import { seasonColumns } from "./seasonColumns";
import { groupRows, totalsRow } from "./seasonRows";
import type { Split } from "./split";

/**
 * Season stats (FEATURES.md 5.5): every position group's table on one page (QB, RB, WR/TE, ...),
 * each with registry columns, big-game counts, season highs and totals; jump links hop between
 * them and one search narrows them all.
 */
export function SeasonStats({ split }: { split: Split }) {
  const { season } = useSeason();
  const active = useFranchise();
  const data = useQuery(api.stats.season.bySplit, season ? { seasonId: season._id, split } : "skip");
  const thresholds = active?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const setStat = useMutation(api.stats.edit.setStat);
  const [search, setSearch] = useState("");

  const tables = useMemo(() => {
    if (!data || !active) return undefined;
    return STAT_GROUPS.map((group) => {
      const rows = groupRows(data, group);
      return {
        group,
        rows,
        totals: totalsRow(rows),
        ...seasonColumns(group, rows, active.userTeam, thresholds),
      };
    }).filter((t) => t.rows.length > 0);
  }, [data, active, thresholds]);

  const text = search.trim().toLowerCase();
  const shown = tables
    ?.map((t) => ({ ...t, rows: text ? t.rows.filter((r) => r.name.toLowerCase().includes(text)) : t.rows }))
    .filter((t) => !text || t.rows.length > 0);
  const preFranchise = season && active && isPreFranchise(season.year, active.franchise.startYear);
  return (
    <div className="space-y-4">
      {preFranchise && (
        <Notice icon={History}>
          {season.year} is real NFL history: season totals for the {active.userTeam.name} imported from
          nflverse. Records, leaders and streaks count only the seasons you play.
        </Notice>
      )}
      {!shown ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : tables?.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={split === "postseason" ? "No playoff stats" : "No stats yet"}
          description="Season stats add up from the box scores you commit, game by game."
        />
      ) : (
        <>
          <JumpLinks
            links={(tables ?? []).map((t) => ({ id: groupAnchor("season", t.group), label: t.group.label }))}
          />
          <FindPlayer value={search} onChange={setSearch} />
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground">No player matches “{search}”.</p>
          )}
          {shown.map(({ group, rows, totals, columns, stats }) => (
            <GroupSection key={group.id} id={groupAnchor("season", group)} group={group}>
              <DataTable
                id={`season-${group.id}`}
                caption={`${group.label} season stats`}
                data={rows}
                columns={columns}
                getRowId={(r) => r.id}
                identityColumn="player"
                primaryColumns={group.phone.filter((k) => stats.includes(k))}
                // Team totals are the whole group's; a search shows only some of it.
                totals={rows.length > 1 && !text ? totals : undefined}
                initialSort={
                  stats.includes(group.lead)
                    ? { id: group.lead, desc: true }
                    : stats[0]
                      ? { id: stats[0], desc: true }
                      : undefined
                }
                onEdit={(row, columnId, value) =>
                  season && active && row.playerId
                    ? setStat({
                        playerId: row.playerId,
                        seasonId: season._id,
                        teamId: active.userTeam._id,
                        split,
                        stat: columnId === "gp" ? GAMES_EDIT_KEY : columnId,
                        value: typeof value === "number" ? value : null,
                      })
                    : undefined
                }
                // Playoff totals from the logs change only through their games; the team row is a sum.
                canEditRow={(row) =>
                  row.playerId !== null && (split === "regular" || row.source === "import")
                }
              />
            </GroupSection>
          ))}
        </>
      )}
      {tables?.some((t) => t.rows.some((r) => r.overridden.length > 0)) && (
        <p className="text-xs text-muted-foreground">
          <span className="text-primary">•</span> {MISSING_GAME_NOTE}.
        </p>
      )}
    </div>
  );
}
