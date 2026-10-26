import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { DataColumn } from "./types";

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
});

type Features = typeof features;
const EMPTY: never[] = [];

/** TanStack Table model for sorting and search. Rendering stays in DataTable. */
export function useTableModel<T extends object>({
  data,
  columns,
  getRowId,
  initialSort,
}: {
  data: readonly T[] | undefined;
  columns: readonly DataColumn<T>[];
  getRowId: (row: T) => string;
  initialSort?: { id: string; desc: boolean };
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ? [initialSort] : []);
  const [globalFilter, setGlobalFilter] = useState("");

  const tableColumns = useMemo<ColumnDef<Features, T>[]>(
    () =>
      columns.map((col) => ({
        id: col.id,
        accessorFn: (row: T) => col.value(row) ?? null,
        enableSorting: col.sortable ?? true,
        sortDescFirst: col.sortDescFirst,
        sortUndefined: "last",
        enableGlobalFilter: col.searchable ?? false,
      })),
    [columns],
  );

  const rows = (data ?? EMPTY) as T[];
  const table = useTable({
    features,
    columns: tableColumns,
    data: rows,
    getRowId: (row: T) => getRowId(row),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => columns.find((c) => c.id === column.id)?.searchable ?? false,
  });

  const toggleSort = (id: string) => table.getColumn(id)?.toggleSorting(undefined, false);
  const sortState = (id: string) => table.getColumn(id)?.getIsSorted() ?? false;

  return {
    rows: table.getRowModel().rows.map((r) => r.original as T),
    sorting,
    setSorting,
    toggleSort,
    sortState,
    globalFilter,
    setGlobalFilter,
  };
}
