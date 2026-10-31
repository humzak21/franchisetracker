import { useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { Segmented } from "@/components/ui/segmented";

export type SplitRow = { key: string; label: string };
export type SplitSection<T extends SplitRow> = { kind: string; label: string; groups: readonly T[] };

/**
 * One kind of split at a time as a `DataTable`: a row per group, the columns the caller declares.
 * Home and away, results and the rest are picked above it, so a phone never scrolls past seven.
 */
export function SplitTable<T extends SplitRow>({
  id,
  caption,
  sections,
  columns,
  primaryColumns,
}: {
  id: string;
  caption: string;
  sections: readonly SplitSection<T>[];
  columns: readonly DataColumn<T>[];
  primaryColumns: readonly string[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const section = sections.find((s) => s.kind === picked) ?? sections[0];
  const all = useMemo<DataColumn<T>[]>(
    () => [
      { id: "split", header: "Split", value: (r) => r.label, sortable: false, minWidth: 130 },
      ...columns,
    ],
    [columns],
  );
  if (!section) return null;
  return (
    <div className="space-y-3">
      <Segmented
        size="sm"
        aria-label="Split by"
        value={section.kind}
        onChange={setPicked}
        options={sections.map((s) => ({ value: s.kind, label: s.label }))}
        className="max-w-full scrollbar-none overflow-x-auto"
      />
      <DataTable<T>
        key={section.kind}
        id={id}
        caption={caption}
        data={section.groups}
        columns={all}
        getRowId={(r) => r.key}
        identityColumn="split"
        primaryColumns={primaryColumns}
      />
    </div>
  );
}
