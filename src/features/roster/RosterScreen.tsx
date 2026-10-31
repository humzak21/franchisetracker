import { ScanFace, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { onRoster, rosterAverages } from "@shared/roster/averages";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { CarryOverButton } from "./CarryOverButton";
import { DepthChartView } from "./DepthChartView";
import { ExpiredContracts } from "./ExpiredContracts";
import { FaceMatchSheet } from "./FaceMatchSheet";
import { RosterAverages } from "./RosterAverages";
import { RosterChanges } from "./RosterChanges";
import { RosterSyncNotice } from "./RosterSyncNotice";
import { RosterTables } from "./RosterTables";
import { RosterTeamSelect } from "./RosterTeamSelect";
import { byDepthOrder, rosterAge } from "./rosterColumns";
import type { RosterSearch } from "./search";

/** Neutral colors for the skeleton rows shown before the roster loads. */
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

type View = "roster" | "depth" | "changes";

const VIEWS: { value: View; label: string }[] = [
  { value: "roster", label: "Roster" },
  { value: "depth", label: "Depth chart" },
  { value: "changes", label: "Changes" },
];

/**
 * Roster (FEATURES.md 5.3): any team's roster for the season, your own by default. Averages, then
 * the position tables, the depth chart, or what changed since another season. Players are added,
 * moved, matched to faces and traded, signed or put on IR from here.
 */
export function RosterScreen({ search }: { search: RosterSearch }) {
  const { season } = useSeason();
  const active = useFranchise();
  const teams = useQuery(api.league.teams.list, {});
  const picked = teams?.find((t) => t.abbr === search.team);
  // A team in the URL waits for the list, so the user team's roster does not flash first.
  const ready = season && (search.team === undefined || teams !== undefined);
  const data = useQuery(
    api.players.roster.bySeason,
    ready ? { seasonId: season._id, teamId: picked?._id } : "skip",
  );
  const [view, setView] = useLocalStorage<View>("ft.roster-view", "roster");
  const [adding, setAdding] = useState(false);
  const [facesOpen, setFacesOpen] = useState(false);
  const year = season?.year ?? 0;

  // Released and traded-away players have left the team: their moves and seasons stay on their
  // own pages and in Transactions, not on the roster.
  const all = useMemo(
    () => (data?.entries ?? []).filter((r) => onRoster(r.entry.status)).sort(byDepthOrder),
    [data],
  );
  const averages = useMemo(
    () =>
      data &&
      rosterAverages(
        all.map((r) => ({
          position: r.entry.position,
          status: r.entry.status,
          age: rosterAge(r, year),
          ovr: r.entry.ovr,
          exp: r.entry.exp,
        })),
      ),
    [data, all, year],
  );
  const unmatched = useMemo(
    () =>
      all
        .filter((r) => r.player.isReal && r.player.espnId === undefined)
        .map((r) => ({ playerId: r.player._id, displayName: r.player.displayName })),
    [all],
  );
  const expired = useMemo(() => all.filter((r) => r.entry.status === "unsigned"), [all]);
  const team = data?.team ?? LOADING_TEAM;
  const userTeamId = active?.franchise.userTeamId;
  const userTeam = data !== undefined && data.team._id === userTeamId;
  const userTeamAbbr = teams?.find((t) => t._id === userTeamId)?.abbr;
  const empty = data !== undefined && all.length === 0;
  const count = all.length;
  const startYear = active?.franchise.startYear;
  const preFranchise =
    season !== undefined && startYear !== undefined && isPreFranchise(season.year, startYear);
  const previousYear =
    userTeam && season && startYear !== undefined && season.year > startYear
      ? active?.seasons.find((s) => s.year === season.year - 1)?.year
      : undefined;
  const emptyNote = preFranchise
    ? "Rosters before the franchise are not imported; each real player's seasons are on their own page."
    : previousYear !== undefined
      ? `Starting a season brings the last one's roster along. This season started without it; bring the ${previousYear} roster over, then record the offseason's moves.`
      : !userTeam && data !== undefined
        ? `Nothing has named a ${data.team.name} player this season. A roster page or a box score against them fills this in.`
        : "Rosters come from the real NFL import for the first season and from roster screenshots. Add players by hand with Add player.";
  const shownView: View = preFranchise ? "roster" : view;

  return (
    <Page
      title="Roster"
      // The count leads: a phone's header cuts the end off, and the season switcher shows the year.
      eyebrow={
        season
          ? `${data ? `${count} player${count === 1 ? "" : "s"} · ` : ""}${season.year} season`
          : undefined
      }
      season
      actions={
        <>
          {unmatched.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setFacesOpen(true)}>
              <ScanFace /> <span className="max-sm:sr-only">Match faces</span> {unmatched.length}
            </Button>
          )}
          {data && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <UserPlus /> <span className="max-sm:sr-only">Add player</span>
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {teams && data && (
            <RosterTeamSelect teams={teams} value={data.team.abbr} userTeamAbbr={userTeamAbbr} />
          )}
          {!preFranchise && (
            <Segmented value={shownView} onChange={setView} options={VIEWS} size="sm" aria-label="View" />
          )}
        </div>
        {season && data && !preFranchise && (
          <RosterSyncNotice seasonId={season._id} teamId={data.team._id} userTeam={userTeam} />
        )}
        {userTeam && <ExpiredContracts rows={expired} />}
        {shownView === "changes" && season && data && startYear !== undefined ? (
          <RosterChanges teamId={data.team._id} team={team} season={season} startYear={startYear} />
        ) : empty ? (
          <EmptyState
            icon={Users}
            title={`No roster for ${season?.year ?? "this season"} yet`}
            description={emptyNote}
            action={
              season && previousYear !== undefined ? (
                <CarryOverButton seasonId={season._id} fromYear={previousYear} />
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-8">
            <RosterAverages averages={averages} />
            {!data || !season ? (
              <Skeleton className="h-96 rounded-xl" />
            ) : shownView === "depth" ? (
              <DepthChartView rows={all} team={team} />
            ) : (
              <RosterTables rows={all} team={team} year={season.year} preFranchise={preFranchise} />
            )}
          </div>
        )}
      </div>
      {season && data && (
        <AddPlayerSheet open={adding} onOpenChange={setAdding} season={season} teamId={data.team._id} />
      )}
      <FaceMatchSheet
        key={unmatched.length}
        players={unmatched}
        open={facesOpen}
        onOpenChange={setFacesOpen}
      />
    </Page>
  );
}
