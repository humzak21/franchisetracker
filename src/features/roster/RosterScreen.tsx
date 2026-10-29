import { ArrowLeftRight, ArrowRightLeft, ScanFace, UserMinus, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { POSITION_GROUPS, positionGroupOf } from "@shared/domain";
import { onRoster, rosterAverages } from "@shared/roster/averages";
import { useFranchise } from "@/app/franchise";
import { useMoves } from "@/app/moves/MovesProvider";
import { useMoveActions } from "@/app/moves/useMoveActions";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { SelectionBar } from "@/components/data/SelectionBar";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { useSelection } from "@/lib/hooks/useSelection";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { CarryOverButton } from "./CarryOverButton";
import { FaceMatchSheet } from "./FaceMatchSheet";
import { PositionTable } from "./PositionTable";
import { RosterAverages } from "./RosterAverages";
import { RosterMoveSheet } from "./RosterMoveSheet";
import { byDepthOrder, positionAnchor, rosterAge, rosterColumns, type RosterRow } from "./rosterColumns";
import { useRosterEdit } from "./useRosterEdit";

/** Neutral colors for the skeleton rows shown before the roster loads. */
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

/**
 * Roster (FEATURES.md 5.3): averages for the team and each side, then every position group in its
 * own table, one after another with jump links, each editable inline. Players are added, moved,
 * matched to faces and traded, signed or put on IR from here.
 */
export function RosterScreen() {
  const { season } = useSeason();
  const data = useQuery(api.players.roster.bySeason, season ? { seasonId: season._id } : "skip");
  const [moving, setMoving] = useState<RosterRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [facesOpen, setFacesOpen] = useState(false);
  const onEdit = useRosterEdit();
  const year = season?.year ?? 0;

  // Released and traded-away players have left the team: their moves and seasons stay on their
  // own pages and in Transactions, not on the roster.
  const all = useMemo(
    () => (data?.entries ?? []).filter((r) => onRoster(r.entry.status)).sort(byDepthOrder),
    [data],
  );
  const groups = useMemo(
    () =>
      POSITION_GROUPS.map((group) => ({
        group,
        rows: all.filter((r) => positionGroupOf(r.entry.position) === group),
      })).filter((g) => g.rows.length > 0),
    [all],
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
  const team = data?.team ?? LOADING_TEAM;
  const active = useFranchise();
  const userTeamId = active?.franchise.userTeamId;
  const moveActions = useMoveActions();
  const moves = useMoves();
  const ids = useMemo(() => all.map((r) => r.player._id), [all]);
  const selection = useSelection(ids);
  const { has, toggle } = selection;
  // Every pick is on this roster, so each starts from the user team's side.
  // The sheet takes the picks over; the roster starts clean for the next batch.
  const batch = (kind: "trade" | "other") => {
    selection.clear();
    moves.open({
      kind,
      prefill: {
        players: all
          .filter((r) => has(r.player._id))
          .map((r) => ({
            person: {
              kind: "existing",
              playerId: r.player._id,
              name: r.player.displayName,
              position: r.entry.position,
            },
            teamId: r.entry.teamId,
          })),
      },
    });
  };
  const columns = useMemo(
    () =>
      rosterColumns(
        team,
        year,
        userTeamId,
        (r) => [
          {
            id: "move",
            label: "Move team or status",
            icon: ArrowRightLeft,
            onSelect: () => setMoving(r),
          },
          ...moveActions({
            playerId: r.player._id,
            name: r.player.displayName,
            position: r.entry.position,
            teamId: r.entry.teamId,
          }),
        ],
        { has, toggle },
      ),
    [team, year, userTeamId, moveActions, has, toggle],
  );
  const empty = data !== undefined && all.length === 0;
  const count = all.length;
  const startYear = active?.franchise.startYear;
  const preFranchise =
    season !== undefined && startYear !== undefined && isPreFranchise(season.year, startYear);
  const previousYear =
    season && startYear !== undefined && season.year > startYear
      ? active?.seasons.find((s) => s.year === season.year - 1)?.year
      : undefined;
  const batchBar = moves.ready && !preFranchise && (
    <SelectionBar
      count={selection.picked.length}
      total={all.length}
      state={selection.state}
      onToggleAll={selection.toggleAll}
      onClear={selection.clear}
    >
      <Button size="sm" variant="outline" onClick={() => batch("trade")}>
        <ArrowLeftRight /> Trade
      </Button>
      <Button size="sm" variant="destructive" onClick={() => batch("other")}>
        <UserMinus /> Release
      </Button>
    </SelectionBar>
  );

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
      {empty ? (
        <EmptyState
          icon={Users}
          title={`No roster for ${season?.year ?? "this season"} yet`}
          description={
            preFranchise
              ? "Rosters before the franchise are not imported; each real player's seasons are on their own page."
              : previousYear !== undefined
                ? `Starting a season brings the last one's roster along. This season started without it; bring the ${previousYear} roster over, then record the offseason's moves.`
                : "Rosters come from the real NFL import for the first season and from roster screenshots. Add players by hand with Add player."
          }
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
          ) : (
            <>
              {/* Picks move the batch bar into the jump links' sticky band, in reach down a long roster. */}
              {selection.picked.length === 0 && batchBar}
              <div className="sticky top-14 z-20 -mx-4 space-y-2 bg-background/90 backdrop-blur @tablet:top-16 @tablet:-mx-6">
                <JumpLinks
                  className="static mx-0 border-b-0 @tablet:mx-0"
                  links={groups.map(({ group, rows }) => ({
                    id: positionAnchor(group),
                    label: `${group} ${rows.length}`,
                  }))}
                />
                {selection.picked.length > 0 && batchBar && (
                  <div className="border-b border-border px-4 pb-2 @tablet:px-6">{batchBar}</div>
                )}
              </div>
              {groups.map(({ group, rows }) => (
                <PositionTable
                  key={group}
                  group={group}
                  year={season.year}
                  rows={rows}
                  columns={columns}
                  onEdit={onEdit}
                />
              ))}
            </>
          )}
        </div>
      )}
      <RosterMoveSheet row={moving} onClose={() => setMoving(null)} />
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
