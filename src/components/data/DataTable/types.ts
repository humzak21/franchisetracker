import type { ReactNode } from "react";
import type { StatKey } from "@shared/stats";

export type ColumnAlign = "left" | "right" | "center";

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
  emptyState?: ReactNode;
  /** Number of skeleton rows while `data` is undefined. */
  loadingRows?: number;
  caption?: string;
  className?: string;
};

export type StatColumnOptions = Partial<Omit<DataColumn<never>, "value" | "cell">> & { highlight?: boolean };
export type StatColumnMeta = { stat: StatKey; highlight: boolean };
