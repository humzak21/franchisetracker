import { useMutation } from "convex/react";
import { Camera, Globe2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { GAMES_EDIT_KEY, STAT_GROUPS, type ThresholdOverrides } from "@shared/stats";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { FindPlayer } from "./FindPlayer";
import { groupAnchor, GroupSection } from "./GroupSection";
import { leagueColumns } from "./leagueColumns";
import { leagueRows, type LeagueRow, type LeagueScope } from "./leagueRows";

const SCOPES: { value: LeagueScope; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "ours", label: "Our team" },
  { value: "others", label: "Rest of league" },
];

/**
 * League stats (FEATURES.md 5.5): every player's regular-season totals across the league, ours
 * from the box scores and everyone else's from captured season stats screens. Every position
 * group's table is on one page, with jump links between them and one search for them all.
 */
export function LeagueStats() {
  const { season } = useSeason();
  const active = useFranchise();
  const capture = useCapture();
  const data = useQuery(api.stats.league.bySeason, season ? { seasonId: season._id } : "skip");
  const [scope, setScope] = useLocalStorage<LeagueScope>("ft.league-stats-scope", "all");
  const [search, setSearch] = useState("");
  const thresholds = active?.franchise.settings.thresholdOverrides as ThresholdOverrides | undefined;
  const setStat = useMutation(api.stats.edit.setStat);

  const tables = useMemo(() => {
    if (!data) return undefined;
    return STAT_GROUPS.map((group) => {
      const rows = leagueRows(data, group, scope);
      return { group, rows, ...leagueColumns(group, rows, thresholds) };
    }).filter((t) => t.rows.length > 0);
  }, [data, scope, thresholds]);
  const othersCaptured = data?.rows.some((r) => !r.isUser) ?? true;
  const text = search.trim().toLowerCase();
  const matches = (r: LeagueRow) =>
    r.name.toLowerCase().includes(text) || (r.team?.abbr.toLowerCase() ?? "") === text;
  const shown = tables
    ?.map((t) => ({ ...t, rows: text ? t.rows.filter(matches) : t.rows }))
    .filter((t) => !text || t.rows.length > 0);

  return (
    <div className="space-y-4">
      <Segmented size="sm" aria-label="Players" value={scope} onChange={setScope} options={SCOPES} />
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
      {!shown ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : tables?.length === 0 ? (
        <EmptyState
          icon={Globe2}
          title="No league stats yet"
          description="League stats come from your box scores and the season stats screens you capture."
        />
      ) : (
        <>
          <JumpLinks
            links={(tables ?? []).map((t) => ({ id: groupAnchor("league", t.group), label: t.group.label }))}
          />
          <FindPlayer value={search} onChange={setSearch} placeholder="Find a player or team" />
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground">No player matches “{search}”.</p>
          )}
          {shown.map(({ group, rows, columns, stats }) => (
            <GroupSection key={group.id} id={groupAnchor("league", group)} group={group}>
              <DataTable
                id={`league-${group.id}`}
                caption={`${group.label} league stats`}
                data={rows}
                columns={columns}
                getRowId={(r) => r.id}
                identityColumn="player"
                primaryColumns={["team", ...group.phone.filter((k) => stats.includes(k))]}
                initialSort={
                  stats.includes(group.lead)
                    ? { id: group.lead, desc: true }
                    : stats[0]
                      ? { id: stats[0], desc: true }
                      : undefined
                }
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
              />
            </GroupSection>
          ))}
        </>
      )}
    </div>
  );
}
