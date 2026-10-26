import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Columns3, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { POSITION_GROUPS, positionGroupOf, type PositionGroup } from "@shared/domain";
import { useFranchise } from "@/app/franchise";
import { DataTable } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { FilterBar, type FilterOption } from "@/components/data/FilterBar";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { playerColumns, type DirectoryRow } from "./playerColumns";
import { PlayerSearch } from "./PlayerSearch";

type GroupFilter = PositionGroup | "all";
const MAX_COMPARE = 4;
const LOADING_TEAM = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

/**
 * Players index (FEATURES.md 5.4): everyone on a team's roster during the franchise, filtered by
 * position and sorted by OVR, age or seasons with the team; a search reaches every player,
 * real history included; tick up to four to compare.
 */
export function PlayersScreen() {
  const active = useFranchise();
  const navigate = useNavigate();
  const teams = useQuery(api.league.teams.list, {});
  const [teamId, setTeamId] = useState<Id<"teams"> | null>(null);
  const data = useQuery(api.players.directory.byTeam, teamId ? { teamId } : {});
  const [group, setGroup] = useState<GroupFilter>("all");
  const [selected, setSelected] = useState<Id<"players">[]>([]);

  const all = useMemo(() => data?.rows ?? [], [data]);
  const rows = useMemo(
    () => (group === "all" ? all : all.filter((r) => positionGroupOf(r.position) === group)),
    [all, group],
  );
  const toggle = (id: Id<"players">) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id].slice(0, MAX_COMPARE),
    );
  const selection = { selected: new Set(selected), toggle, full: selected.length >= MAX_COMPARE };
  const columns = playerColumns(data?.team ?? LOADING_TEAM, selection);
  const groupOptions: FilterOption<GroupFilter>[] = [
    { value: "all", label: "All", count: all.length },
    ...POSITION_GROUPS.filter((g) => all.some((r) => positionGroupOf(r.position) === g)).map((g) => ({
      value: g,
      label: g,
      count: all.filter((r) => positionGroupOf(r.position) === g).length,
    })),
  ];
  const compare = () => void navigate({ to: "/players/compare", search: { ids: selected } });

  return (
    <Page
      title="Players"
      eyebrow={data ? `${data.team.city} ${data.team.name}` : undefined}
      actions={
        selected.length > 0 && (
          <Button size="sm" variant="primary" onClick={compare}>
            <Columns3 /> Compare {selected.length}
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
