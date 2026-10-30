import { useMutation } from "convex/react";
import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { MISSING_GAME_NOTE } from "@shared/ingestion/reconcile";
import { GAMES_EDIT_KEY, seasonInProgress, STAT_GROUPS, type ThresholdOverrides } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { FindPlayer } from "./FindPlayer";
import { groupAnchor, GroupSection } from "./GroupSection";
import { seasonColumns } from "./seasonColumns";
import { groupRows, paceRows, totalsRow } from "./seasonRows";
import type { Split } from "./split";

type Display = "totals" | "pace" | "yoy";

const DISPLAYS: { value: Display; label: string }[] = [
  { value: "totals", label: "Totals" },
  { value: "pace", label: "On pace" },
  { value: "yoy", label: "Vs last year" },
];

/**
 * Season stats (FEATURES.md 5.5): every position group's table on one page (QB, RB, WR/TE, ...),
 * each with registry columns, big-game counts, season highs and totals; jump links hop between
 * them and one search narrows them all. While a season runs the numbers can show its pace, and any
 * season can show each change from the one before.
 */
export function SeasonStats({ split }: { split: Split }) {
  const { season } = useSeason();
  const active = useFranchise();
  const data = useQuery(api.stats.season.bySplit, season ? { seasonId: season._id, split } : "skip");
  const thresholds = active?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const setStat = useMutation(api.stats.edit.setStat);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useLocalStorage<Display>("ft.stats-season-display", "totals");

  const { seasons } = useSeason();
  const previous = seasons.find((s) => season && s.year === season.year - 1);
  const record = season?.userRecord;
  const teamGames = (record?.w ?? 0) + (record?.l ?? 0) + (record?.t ?? 0);
  const gamesPerSeason = active?.franchise.settings.gamesPerSeason ?? 17;
  const live = split === "regular" && !!season && seasonInProgress(season.status, teamGames, gamesPerSeason);
  const options = DISPLAYS.filter((d) => (d.value !== "pace" || live) && (d.value !== "yoy" || previous));
  const display = options.some((o) => o.value === picked) ? picked : "totals";
  const lastYear = useQuery(
    api.stats.season.bySplit,
    display === "yoy" && previous ? { seasonId: previous._id, split } : "skip",
  );

  const tables = useMemo(() => {
    if (!data || !active) return undefined;
    const before = display === "yoy" ? lastYear : undefined;
    return STAT_GROUPS.map((group) => {
      const counted = groupRows(data, group);
      const rows = display === "pace" ? paceRows(counted, teamGames, gamesPerSeason) : counted;
      return {
        group,
        rows,
        totals: totalsRow(rows),
        ...seasonColumns(group, rows, active.userTeam, thresholds, before),
      };
    }).filter((t) => t.rows.length > 0);
  }, [data, active, thresholds, display, lastYear, teamGames, gamesPerSeason]);

  const text = search.trim().toLowerCase();
  const shown = tables
    ?.map((t) => ({ ...t, rows: text ? t.rows.filter((r) => r.name.toLowerCase().includes(text)) : t.rows }))
    .filter((t) => !text || t.rows.length > 0);
  return (
    <div className="space-y-4">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-48 flex-1">
              <FindPlayer value={search} onChange={setSearch} />
            </div>
            {options.length > 1 && (
              <Segmented size="sm" aria-label="Show" value={display} onChange={setPicked} options={options} />
            )}
          </div>
          {display === "yoy" && live && (
            <p className="text-xs text-muted-foreground">
              {teamGames} games so far against all of {previous?.year}.
            </p>
          )}
          {display === "pace" && (
            <p className="text-xs text-muted-foreground">
              Projected from {teamGames} of {gamesPerSeason} games, if each player plays the rest at the same
              rate.
            </p>
          )}
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
                  display === "totals" && season && active && row.playerId
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
                  display === "totals" &&
                  row.playerId !== null &&
                  (split === "regular" || row.source === "import")
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
