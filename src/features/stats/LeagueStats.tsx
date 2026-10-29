import { useMutation } from "convex/react";
import { Camera, Globe2 } from "lucide-react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import { GAMES_EDIT_KEY, STAT_GROUPS, statGroup, type ThresholdOverrides } from "@shared/stats";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { leagueColumns } from "./leagueColumns";
import { leagueRows, type LeagueScope } from "./leagueRows";

const SCOPES: { value: LeagueScope; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "ours", label: "Our team" },
  { value: "others", label: "Rest of league" },
];

/**
 * League stats (FEATURES.md 5.5): every player's regular-season totals across the league, ours
 * from the box scores and everyone else's from captured season stats screens.
 */
export function LeagueStats() {
  const { season } = useSeason();
  const active = useFranchise();
  const capture = useCapture();
  const data = useQuery(api.stats.league.bySeason, season ? { seasonId: season._id } : "skip");
  const [groupId, setGroupId] = useLocalStorage("ft.league-stats-group", STAT_GROUPS[0]!.id);
  const [scope, setScope] = useLocalStorage<LeagueScope>("ft.league-stats-scope", "all");
  const group = statGroup(groupId);
  const thresholds = active?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const setStat = useMutation(api.stats.edit.setStat);

  const table = useMemo(() => {
    if (!data) return undefined;
    const rows = leagueRows(data, group, scope);
    return { rows, ...leagueColumns(group, rows, thresholds) };
  }, [data, group, scope, thresholds]);
  const othersCaptured = data?.rows.some((r) => !r.isUser) ?? true;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div data-swipe-ignore className="-mx-1 max-w-full scrollbar-none overflow-x-auto px-1">
          <Segmented
            size="sm"
            aria-label="Position group"
            value={group.id}
            onChange={setGroupId}
            options={STAT_GROUPS.map((g) => ({ value: g.id, label: g.label }))}
          />
        </div>
        <Segmented size="sm" aria-label="Players" value={scope} onChange={setScope} options={SCOPES} />
      </div>
      {!othersCaptured && (
        <EmptyState
          icon={Globe2}
          title="Only your team so far"
          description="Capture Madden's season stats screens for the league (any team, any tab) and every player's totals land here."
          action={
            <Button variant="primary" onClick={() => capture.open({ targetKey: "season_player_stats" })}>
              <Camera /> Capture league stats
            </Button>
          }
        />
      )}
      {!table ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <DataTable
          key={`${group.id}-${scope}`}
          id={`league-${group.id}`}
          caption={`${group.label} league stats`}
          data={table.rows}
          columns={table.columns}
          getRowId={(r) => r.id}
          identityColumn="player"
          primaryColumns={["team", ...group.phone.filter((k) => table.stats.includes(k))]}
          initialSort={
            table.stats.includes(group.lead)
              ? { id: group.lead, desc: true }
              : table.stats[0]
                ? { id: table.stats[0], desc: true }
                : undefined
          }
          searchable
          searchPlaceholder="Find a player or team"
          onEdit={(row, columnId, value) =>
            season
              ? setStat({
                  playerId: row.playerId,
                  seasonId: season._id,
                  teamId: row.teamId,
                  split: "regular",
                  stat: columnId === "gp" ? GAMES_EDIT_KEY : columnId,
                  value: typeof value === "number" ? value : null,
                })
              : undefined
          }
          emptyState={
            <EmptyState
              icon={Globe2}
              title="No league stats yet"
              description="League stats come from your box scores and the season stats screens you capture."
            />
          }
        />
      )}
    </div>
  );
}
