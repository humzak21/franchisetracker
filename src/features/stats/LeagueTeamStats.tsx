import { Camera, Shield } from "lucide-react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { leagueTeamColumnDef, leagueTeamValue, type LeagueTeamLine } from "@shared/stats/leagueTeamRegistry";
import {
  LEAGUE_TEAM_TAB_DEFS,
  LEAGUE_TEAM_TABS,
  leagueTeamColumns,
  type LeagueTeamTab,
} from "@shared/stats/leagueTeamTabs";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useSeason } from "@/app/season";
import { DataTable, formattedColumn, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { TeamChip } from "@/components/team/TeamChip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

type Row = FunctionReturnType<typeof api.league.teamStats.leagueBySeason>[number];
type Scale = "totals" | "perGame";

const SCALES: { value: Scale; label: string }[] = [
  { value: "totals", label: "Totals" },
  { value: "perGame", label: "Per game" },
];

function columns(keys: ReturnType<typeof leagueTeamColumns>, perGame: boolean): DataColumn<Row>[] {
  const team: DataColumn<Row> = {
    id: "team",
    header: "Team",
    value: (r) => r.team.name,
    searchable: true,
    sortable: false,
    minWidth: 150,
    cell: (r) => <TeamChip team={r.team} className={cn(r.isUser && "text-primary")} />,
  };
  return [
    team,
    ...keys.map((key) =>
      formattedColumn<Row>(key, leagueTeamColumnDef(key, perGame), (r) =>
        leagueTeamValue(key, r.stats as LeagueTeamLine, { games: r.games }, perGame),
      ),
    ),
  ];
}

/**
 * Every team's season (FEATURES.md 5.5): an overview, then one Madden team stats tab at a time
 * (offense, defense, conversions, red zone, turnovers), as season totals or per game played.
 * From the league team stats screen or typed in.
 */
export function LeagueTeamStats() {
  const { season } = useSeason();
  const capture = useCapture();
  const data = useQuery(api.league.teamStats.leagueBySeason, season ? { seasonId: season._id } : "skip");
  const [tabId, setTab] = useLocalStorage<LeagueTeamTab>("ft.league-team-tab", "overview");
  const [scale, setScale] = useLocalStorage<Scale>("ft.league-team-scale", "totals");
  const tab = LEAGUE_TEAM_TABS.includes(tabId) ? tabId : "overview";
  const perGame = scale === "perGame";
  const def = LEAGUE_TEAM_TAB_DEFS[tab];
  const keys = useMemo(() => leagueTeamColumns(tab, perGame), [tab, perGame]);
  const cols = useMemo(() => columns(keys, perGame), [keys, perGame]);
  const lead = keys.includes(def.lead) ? def.lead : keys[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div data-swipe-ignore className="-mx-1 max-w-full scrollbar-none overflow-x-auto px-1">
          <Segmented
            size="sm"
            aria-label="Team stats tab"
            value={tab}
            onChange={setTab}
            options={LEAGUE_TEAM_TABS.map((t) => ({ value: t, label: LEAGUE_TEAM_TAB_DEFS[t].label }))}
          />
        </div>
        <Segmented
          size="sm"
          aria-label="Totals or per game"
          value={scale}
          onChange={setScale}
          options={SCALES}
        />
      </div>
      {data === undefined ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : (
        <DataTable
          key={`${tab}-${scale}`}
          id={`league-teams-${tab}-${scale}`}
          caption={`${def.label} team stats${perGame ? " per game" : ""}`}
          data={data}
          columns={cols}
          getRowId={(r) => r.team._id}
          identityColumn="team"
          primaryColumns={def.phone.filter((k) => keys.includes(k))}
          initialSort={
            lead ? { id: lead, desc: leagueTeamColumnDef(lead, perGame).better === "higher" } : undefined
          }
          searchable
          searchPlaceholder="Find a team"
          emptyState={
            <EmptyState
              icon={Shield}
              title="No team stats yet"
              description="Capture Madden's team stats screen in the NFL view, one shot per tab, and all 32 teams land here."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => capture.open({ targetKey: "league_team_stats" })}>
                    <Camera /> Capture team stats
                  </Button>
                  {season && (
                    <ManualEntryLink target="league_team_stats" seasonId={season._id} label="Type them in" />
                  )}
                </div>
              }
            />
          }
        />
      )}
      {perGame && data && data.length > 0 && (
        <p className="text-xs text-subtle-foreground">
          Per game uses each team's games from the standings, else ours, else 17. Percentages and per-game
          figures read the same either way.
        </p>
      )}
    </div>
  );
}
