import { ScanFace, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { POSITION_GROUPS, SIDES, positionGroupOf, sideOf, type PositionGroup } from "@shared/domain";
import { rosterAverages } from "@shared/roster/averages";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar, type FilterOption } from "@/components/data/FilterBar";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { FaceMatchSheet } from "./FaceMatchSheet";
import { RosterAverages } from "./RosterAverages";
import { RosterMoveSheet } from "./RosterMoveSheet";
import { byDepthOrder, rosterAge, rosterColumns, type RosterRow } from "./rosterColumns";
import { SideTable } from "./SideTable";
import { useRosterEdit } from "./useRosterEdit";

type GroupFilter = PositionGroup | "all";

/** Neutral colors for the skeleton rows shown before the roster loads. */
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

/**
 * Roster (FEATURES.md 5.3): averages for the team and each side, then offense, defense and special
 * teams in their own tables, each editable inline. Players are added, moved and matched to faces here.
 */
export function RosterScreen() {
  const { season } = useSeason();
  const data = useQuery(api.players.roster.bySeason, season ? { seasonId: season._id } : "skip");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [moving, setMoving] = useState<RosterRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [facesOpen, setFacesOpen] = useState(false);
  const onEdit = useRosterEdit();
  const year = season?.year ?? 0;

  const all = useMemo(() => [...(data?.entries ?? [])].sort(byDepthOrder), [data]);
  const rows = useMemo(
    () => (group === "all" ? all : all.filter((r) => positionGroupOf(r.entry.position) === group)),
    [all, group],
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
  const groupOptions: FilterOption<GroupFilter>[] = [
    { value: "all", label: "All positions", count: all.length },
    ...POSITION_GROUPS.filter((g) => all.some((r) => positionGroupOf(r.entry.position) === g)).map((g) => ({
      value: g,
      label: g,
      count: all.filter((r) => positionGroupOf(r.entry.position) === g).length,
    })),
  ];

  const unmatched = useMemo(
    () =>
      all
        .filter((r) => r.player.isReal && r.player.espnId === undefined)
        .map((r) => ({ playerId: r.player._id, displayName: r.player.displayName })),
    [all],
  );
  const team = data?.team ?? LOADING_TEAM;
  const columns = useMemo(() => rosterColumns(team, year, setMoving), [team, year]);
  const empty = data !== undefined && all.length === 0;
  const startYear = useFranchise()?.franchise.startYear;
  const preFranchise =
    season !== undefined && startYear !== undefined && isPreFranchise(season.year, startYear);

  return (
    <Page
      title="Roster"
      eyebrow={season ? `${season.year} season` : undefined}
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
              : "Rosters come from the real NFL import for the first season and from roster screenshots. Add players by hand with Add player."
          }
        />
      ) : (
        <div className="space-y-8">
          <RosterAverages averages={averages} />
          <div className="@container">
            <FilterBar label="Position" value={group} onChange={setGroup} options={groupOptions} />
          </div>
          {SIDES.map((side) => {
            const sideRows = rows.filter((r) => sideOf(r.entry.position) === side);
            // A position filter hides the sides it leaves empty.
            if (data && group !== "all" && sideRows.length === 0) return null;
            return (
              <SideTable
                key={side}
                side={side}
                year={season?.year}
                rows={data ? sideRows : undefined}
                columns={columns}
                onEdit={onEdit}
              />
            );
          })}
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
