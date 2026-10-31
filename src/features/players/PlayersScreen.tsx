import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftRight, Columns3, UserMinus, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { POSITION_GROUPS, positionGroupOf, type PositionGroup } from "@shared/domain";
import { currentSeason, useFranchise } from "@/app/franchise";
import type { PrefillPlayer } from "@/app/moves/forms/moveForm";
import { useMoves } from "@/app/moves/MovesProvider";
import { useMoveActions } from "@/app/moves/useMoveActions";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar, type FilterOption } from "@/components/data/FilterBar";
import { SelectionBar } from "@/components/data/SelectionBar";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { playerColumns, type DirectoryRow } from "./playerColumns";
import { PlayerSearch } from "@/components/player/PlayerSearch";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";
import { useSelection } from "@/lib/hooks/useSelection";

type GroupFilter = PositionGroup | "all";
/** Compare reads two to four players side by side. */
const COMPARE = { min: 2, max: 4 };
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

/**
 * Players index (FEATURES.md 5.4): everyone on a team's roster during the franchise, filtered by
 * position and sorted by OVR, age or seasons with the team; a search reaches every player,
 * real history included. Picked players are compared (two to four), signed, released or put in
 * a trade together.
 */
export function PlayersScreen() {
  const active = useFranchise();
  const navigate = useNavigate();
  const teams = useQuery(api.league.teams.list, {});
  const [teamId, setTeamId] = useState<Id<"teams"> | null>(null);
  const data = useQuery(api.players.directory.byTeam, teamId ? { teamId } : {});
  const [group, setGroup] = useState<GroupFilter>("all");

  const all = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(
    () => (group === "all" ? all : all.filter((r) => positionGroupOf(r.position) === group)),
    [all, group],
  );
  const ids = useMemo(() => rows.map((r) => r.playerId), [rows]);
  const selection = useSelection(ids);
  const moveActions = useMoveActions();
  const moves = useMoves();
  const currentYear = active ? currentSeason(active.seasons)?.year : undefined;
  const userTeamId = active?.franchise.userTeamId;
  // Only someone on this roster now (not released or traded away) is known to be on this team.
  const teamOf = (r: DirectoryRow) =>
    data && r.onRoster && r.latestYear === currentYear ? data.team._id : undefined;
  const columns = playerColumns(data?.team ?? LOADING_TEAM, selection, (r) =>
    moveActions({ playerId: r.playerId, name: r.displayName, position: r.position, teamId: teamOf(r) }),
  );
  const picked: PrefillPlayer[] = rows
    .filter((r) => selection.has(r.playerId))
    .map((r) => ({
      person: { kind: "existing", playerId: r.playerId, name: r.displayName, position: r.position },
      teamId: teamOf(r),
    }));
  const ours = picked.filter((p) => p.teamId === userTeamId);
  const others = picked.filter((p) => p.teamId !== userTeamId);
  const batch = (kind: "trade" | "sign" | "other", players: PrefillPlayer[]) => {
    selection.clear();
    moves.open({ kind, prefill: { players } });
  };
  const groupOptions: FilterOption<GroupFilter>[] = [
    { value: "all", label: "All", count: all.length },
    ...POSITION_GROUPS.filter((g) => all.some((r) => positionGroupOf(r.position) === g)).map((g) => ({
      value: g,
      label: g,
      count: all.filter((r) => positionGroupOf(r.position) === g).length,
    })),
  ];
  const canCompare = picked.length >= COMPARE.min && picked.length <= COMPARE.max;
  const compare = () => void navigate({ to: "/players/compare", search: { ids: selection.picked } });

  return (
    <Page
      title="Players"
      eyebrow={data ? `${data.team.city} ${data.team.name}` : undefined}
      actions={
        canCompare && (
          <Button size="sm" variant="primary" onClick={compare}>
            <Columns3 /> Compare {picked.length}
          </Button>
        )
      }
    >
      <div className="@container space-y-8">
        <Section title="Find anyone" description="Every player in the franchise, real NFL history included.">
          <PlayerSearch
            placeholder="Search players by name"
            action={(hit) => (
              <Button asChild size="sm" variant="ghost">
                <Link to="/players/$playerId" params={{ playerId: hit.playerId }}>
                  Open
                </Link>
              </Button>
            )}
          />
        </Section>
        <Section title="Roster through the franchise">
          <div className="mb-3 grid gap-2 @tablet:grid-cols-[16rem_1fr]">
            <Select
              aria-label="Team"
              value={teamId ?? active?.userTeam._id ?? ""}
              onValueChange={(id) => {
                setTeamId(id as Id<"teams">);
                setGroup("all");
              }}
              options={(teams ?? []).map((t) => ({ value: t._id, label: `${t.city} ${t.name}` }))}
            />
            <FilterBar label="Position" value={group} onChange={setGroup} options={groupOptions} />
          </div>
          <SelectionBar
            className={cn("mb-3", picked.length > 0 && "sticky top-16 z-20 shadow-lg max-sm:top-14")}
            count={selection.picked.length}
            total={rows.length}
            state={selection.state}
            onToggleAll={selection.toggleAll}
            onClear={selection.clear}
          >
            {canCompare && (
              <Button size="sm" variant="outline" onClick={compare}>
                <Columns3 /> Compare
              </Button>
            )}
            {moves.ready && others.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => batch("sign", others)}>
                <UserPlus /> Sign {others.length}
              </Button>
            )}
            {moves.ready && ours.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => batch("other", ours)}>
                <UserMinus /> Release {ours.length}
              </Button>
            )}
            {moves.ready && (
              <Button size="sm" variant="outline" onClick={() => batch("trade", picked)}>
                <ArrowLeftRight /> Trade
              </Button>
            )}
          </SelectionBar>
          <DataTable<DirectoryRow>
            id="players-index"
            data={data ? rows : undefined}
            columns={columns}
            getRowId={(r) => r.playerId}
            identityColumn="player"
            primaryColumns={["pos", "ovr", "seasons"]}
            initialSort={{ id: "ovr", desc: true }}
            searchable
            searchPlaceholder="Filter this list"
            caption="Players"
            onRowClick={(r) => void navigate({ to: "/players/$playerId", params: { playerId: r.playerId } })}
            emptyState={
              <EmptyState
                icon={Users}
                title={all.length === 0 ? "Nobody on this roster yet" : "No players match"}
                description={
                  all.length === 0
                    ? "Rosters fill from the real NFL import for the first season and from what you capture after."
                    : "Try another position."
                }
              />
            }
          />
        </Section>
      </div>
    </Page>
  );
}
