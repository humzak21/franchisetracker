import { POSITION_GROUP_LABELS, type PositionGroup } from "@shared/domain";
import { DataTable, type DataColumn, type EditValue } from "@/components/data/DataTable";
import { Section } from "@/components/layout/Section";
import { positionAnchor, type RosterRow } from "./rosterColumns";

type PositionTableProps = {
  group: PositionGroup;
  year: number;
  rows: readonly RosterRow[];
  columns: readonly DataColumn<RosterRow>[];
  onEdit: (row: RosterRow, columnId: string, value: EditValue) => Promise<unknown>;
};

/** One position group's roster table, editable inline; its caption names it for tests and readers. */
export function PositionTable({ group, year, rows, columns, onEdit }: PositionTableProps) {
  const title = POSITION_GROUP_LABELS[group];
  return (
    <Section
      id={positionAnchor(group)}
      title={title}
      description={`${rows.length} player${rows.length === 1 ? "" : "s"}`}
    >
      <DataTable<RosterRow>
        id={`roster-${group.toLowerCase()}`}
        data={rows}
        columns={columns}
        getRowId={(r) => r.entry._id}
        identityColumn="player"
        primaryColumns={["position", "ovr", "age"]}
        caption={`${year} ${title.toLowerCase()}`}
        onEdit={onEdit}
      />
    </Section>
  );
}
