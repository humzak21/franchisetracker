import { Users } from "lucide-react";
import type { Side } from "@shared/domain";
import { DataTable, type DataColumn, type EditValue } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import type { RosterRow } from "./rosterColumns";

export const SIDE_TITLES: Record<Side, string> = {
  offense: "Offense",
  defense: "Defense",
  special: "Special teams",
};

type SideTableProps = {
  side: Side;
  year: number | undefined;
  rows: readonly RosterRow[] | undefined;
  columns: readonly DataColumn<RosterRow>[];
  onEdit: (row: RosterRow, columnId: string, value: EditValue) => Promise<unknown>;
};

/** One side of the ball's roster table, editable inline; its caption names it for tests and readers. */
export function SideTable({ side, year, rows, columns, onEdit }: SideTableProps) {
  const title = SIDE_TITLES[side];
  return (
    <Section
      id={side}
      title={title}
      description={rows ? `${rows.length} player${rows.length === 1 ? "" : "s"}` : undefined}
    >
      <DataTable<RosterRow>
        id={`roster-${side}`}
        data={rows}
        columns={columns}
        getRowId={(r) => r.entry._id}
        identityColumn="player"
        primaryColumns={["position", "ovr", "age"]}
        caption={`${year ?? ""} ${title.toLowerCase()}`.trim()}
        loadingRows={side === "special" ? 2 : 6}
        onEdit={onEdit}
        emptyState={
          <EmptyState
            icon={Users}
            title={`No ${title.toLowerCase()} players`}
            description="Add one, or move a player here."
          />
        }
      />
    </Section>
  );
}
