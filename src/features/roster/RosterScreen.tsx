import { ScanFace, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { POSITION_GROUPS, positionGroupOf, sideOf, type PositionGroup, type Side } from "@shared/domain";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar, type FilterOption } from "@/components/data/FilterBar";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { FaceMatchSheet } from "./FaceMatchSheet";
import { byDepthOrder, rosterColumns, type RosterRow } from "./rosterColumns";
import { useQuery } from "@/lib/convex/useQuery";

type SideFilter = Side | "all";
type GroupFilter = PositionGroup | "all";

const SIDE_LABELS: Record<SideFilter, string> = {
  all: "All sides",
  offense: "Offense",
  defense: "Defense",
  special: "Special teams",
};

/** Neutral colors for the skeleton rows shown before the roster loads. */
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

function count<T>(rows: readonly T[], match: (row: T) => boolean): number {
  return rows.reduce((n, row) => n + (match(row) ? 1 : 0), 0);
}

export function RosterScreen() {
  const { season } = useSeason();
  const data = useQuery(api.players.roster.bySeason, season ? { seasonId: season._id } : "skip");
  const [side, setSide] = useState<SideFilter>("all");
  const [group, setGroup] = useState<GroupFilter>("all");

  const all = useMemo(() => [...(data?.entries ?? [])].sort(byDepthOrder), [data]);
  const inSide = useMemo(
    () => (side === "all" ? all : all.filter((r) => sideOf(r.entry.position) === side)),
    [all, side],
  );
  const rows = useMemo(
    () => (group === "all" ? inSide : inSide.filter((r) => positionGroupOf(r.entry.position) === group)),
    [inSide, group],
  );

  const sideOptions: FilterOption<SideFilter>[] = (Object.keys(SIDE_LABELS) as SideFilter[]).map((value) => ({
    value,
    label: SIDE_LABELS[value],
    count: value === "all" ? all.length : count(all, (r) => sideOf(r.entry.position) === value),
  }));
  const groupOptions: FilterOption<GroupFilter>[] = [
    { value: "all", label: "All positions" },
    ...POSITION_GROUPS.filter((g) => inSide.some((r) => positionGroupOf(r.entry.position) === g)).map(
      (g) => ({
        value: g,
        label: g,
        count: count(inSide, (r) => positionGroupOf(r.entry.position) === g),
      }),
    ),
  ];

  const unmatched = useMemo(
    () =>
      all
        .filter((r) => r.player.isReal && r.player.espnId === undefined)
        .map((r) => ({ playerId: r.player._id, displayName: r.player.displayName })),
    [all],
  );
  const [facesOpen, setFacesOpen] = useState(false);
  const team = data?.team ?? LOADING_TEAM;
  const year = season?.year ?? 0;
  const columns = useMemo(() => rosterColumns(team, year), [team, year]);
  const empty = all.length === 0;
  const startYear = useFranchise()?.franchise.startYear;
  const preFranchise =
    season !== undefined && startYear !== undefined && isPreFranchise(season.year, startYear);

  return (
    <Page
      title="Roster"
      eyebrow={season ? `${season.year} season` : undefined}
      season
      actions={
        unmatched.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setFacesOpen(true)}>
            <ScanFace /> <span className="max-sm:sr-only">Match faces</span> {unmatched.length}
          </Button>
        )
      }
    >
      {/* Each filter gets a full cell: FilterBar picks chips or a sheet from its own width. */}
      <div className="@container mb-3">
        <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-1">
          <FilterBar
            label="Side"
            value={side}
            onChange={(next) => {
              setSide(next);
              setGroup("all");
            }}
            options={sideOptions}
          />
          <FilterBar label="Position" value={group} onChange={setGroup} options={groupOptions} />
        </div>
      </div>
      <DataTable<RosterRow>
        id="roster"
        data={data ? rows : undefined}
        columns={columns}
        getRowId={(r) => r.entry._id}
        identityColumn="player"
        primaryColumns={["pos", "ovr", "age"]}
        searchable
        searchPlaceholder="Search players"
        caption={`${season?.year ?? ""} roster`}
        emptyState={
          <EmptyState
            icon={Users}
            title={empty ? `No roster for ${season?.year ?? "this season"} yet` : "No players match"}
            description={
              !empty
                ? "Try another side or position."
                : preFranchise
                  ? "Rosters before the franchise are not imported; each real player's seasons are on their own page."
                  : "Rosters come from the real NFL import for the first season and from roster screenshots (Sprint 6)."
            }
          />
        }
      />
      <FaceMatchSheet
        key={unmatched.length}
        players={unmatched}
        open={facesOpen}
        onOpenChange={setFacesOpen}
      />
    </Page>
  );
}
