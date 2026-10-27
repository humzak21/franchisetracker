import type { ReactNode } from "react";
import type { StatKey } from "@shared/stats";
import type { SelectOption } from "@/components/ui/select";

export type ColumnAlign = "left" | "right" | "center";

/** A cell's new value from edit mode: `null` clears it. */
export type EditValue = string | number | null;

/** How a column's cells edit when the table is in edit mode. */
export type ColumnEdit<T> =
  | { kind: "number"; get: (row: T) => number | null | undefined; min?: number; max?: number; step?: number }
  | { kind: "text"; get: (row: T) => string | null | undefined; placeholder?: string }
  | { kind: "select"; get: (row: T) => string | null | undefined; options: readonly SelectOption[] };

/**
 * A DataTable column. Declarative on purpose: screens describe columns, the table decides how
 * they render at each width. Use `statColumn()` for anything in the stat registry.
 */
export type DataColumn<T> = {
  id: string;
  /** Short header (the stat abbreviation for stat columns). */
  header: string;
  /** Full name, shown as a tooltip on desktop and as the label in phone expansion cards. */
  title?: string;
  /** Value used for sorting and search. */
  value: (row: T) => string | number | null | undefined;
  /** Custom renderer. Defaults to the formatted value. */
  cell?: (row: T) => ReactNode;
  align?: ColumnAlign;
  /** Column group header (e.g. "Passing", "Rushing"). Adjacent columns with the same group merge. */
  group?: string;
  sortable?: boolean;
  /** First sort click direction. Stats default to descending. */
  sortDescFirst?: boolean;
  /** Included in global search. Defaults to true for string-valued identity columns only. */
  searchable?: boolean;
  /** Minimum width in px. */
  minWidth?: number;
  /** Editable in edit mode (the table needs `onEdit`). */
  edit?: ColumnEdit<T>;
};

export type DataTableProps<T> = {
  /** Stable id; column preferences are remembered under it. */
  id: string;
  data: readonly T[] | undefined;
  columns: readonly DataColumn<T>[];
  getRowId: (row: T) => string;
  /** The pinned identity column (player, team, season). Must be a column id. */
  identityColumn: string;
  /** Columns shown in the phone table; the rest go into the tap-to-expand card. */
  primaryColumns: readonly string[];
  /** Totals row rendered in the footer. */
  totals?: T;
  initialSort?: { id: string; desc: boolean };
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Show the sort and column picker. Off for short reference grids where every column fits. */
  columnOptions?: boolean;
  onRowClick?: (row: T) => void;
  /**
   * Saves one edited cell. Passing it adds an Edit button that turns every column with `edit`
   * into inputs, in the table and in the phone's expansion cards. Rejecting shows the error.
   */
  onEdit?: (row: T, columnId: string, value: EditValue) => Promise<unknown> | void;
  /** Rows that stay read-only in edit mode (a computed row, another team's player). */
  canEditRow?: (row: T) => boolean;
  emptyState?: ReactNode;
  /** Number of skeleton rows while `data` is undefined. */
  loadingRows?: number;
  caption?: string;
  className?: string;
};

export type StatColumnOptions = Partial<Omit<DataColumn<never>, "value" | "cell" | "edit">> & {
  highlight?: boolean;
};
export type StatColumnMeta = { stat: StatKey; highlight: boolean };
