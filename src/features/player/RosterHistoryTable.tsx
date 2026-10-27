import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ageInSeason } from "@shared/players/format";
import { entryCellPatch } from "@shared/roster/entryCell";
import { DataTable, type DataColumn, type EditValue } from "@/components/data/DataTable";
import { rosterEntryColumns } from "@/components/player/rosterEntryColumns";
import { TeamChip } from "@/components/team/TeamChip";
import type { SelectOption } from "@/components/ui/select";
import type { HistoryRow, PlayerPage } from "./types";

function historyColumns(
  player: PlayerPage["player"],
  teams: readonly SelectOption[],
): DataColumn<HistoryRow>[] {
  const c = rosterEntryColumns<HistoryRow>(
    (r) => r.entry,
    (r) => r.entry.age ?? ageInSeason(player, r.year),
  );
  return [
    {
      id: "season",
      header: "Season",
      value: (r) => r.year,
      cell: (r) => <span className="num font-medium">{r.year}</span>,
    },
    {
      id: "team",
      header: "Team",
      value: (r) => r.team.abbr,
      cell: (r) => <TeamChip team={r.team} label="abbr" size="xs" />,
      edit: { kind: "select", get: (r) => r.entry.teamId, options: teams },
    },
    c.jersey,
    c.position,
    c.ovr,
    c.devTrait,
    c.age,
    c.exp,
    c.status,
    c.statusWeekKey,
    c.acquisitionType,
    c.acquisitionYear,
    c.acquisitionDetail,
    c.contractYears,
    c.contractApy,
    c.contractExpiresYear,
    c.abilities,
    c.gradeNote,
  ];
}

/**
 * Every season the player was on a roster in this franchise, oldest first. Edit mode corrects any
 * season's entry in place, team included (a correction; Move changes teams going forward).
 */
export function RosterHistoryTable({ page, teams }: { page: PlayerPage; teams: readonly SelectOption[] }) {
  const updateEntry = useMutation(api.players.roster.updateEntry);
  const columns = useMemo(() => historyColumns(page.player, teams), [page.player, teams]);
  const onEdit = async (row: HistoryRow, columnId: string, value: EditValue) => {
    const entryId = row.entry._id;
    if (columnId === "team" && typeof value === "string")
      return await updateEntry({ entryId, patch: {}, teamId: value as Id<"teams"> });
    const patch = entryCellPatch(columnId, value);
    if (patch === null) return null;
    if (!patch.ok) throw new ConvexError({ code: "invalid", message: patch.error });
    return await updateEntry({ entryId, patch: patch.fields });
  };
  return (
    <DataTable
      id="player-roster-history"
      data={page.history}
      columns={columns}
      getRowId={(r) => r.entry._id}
      identityColumn="season"
      primaryColumns={["team", "ovr", "age"]}
      caption="Roster history"
      onEdit={onEdit}
    />
  );
}
