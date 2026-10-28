import { formatValue, getStat, type StatFormat, type StatKey, type ThresholdOverrides } from "@shared/stats";
import { cn } from "@/lib/cn";
import { StatCell } from "../StatCell";
import type { DataColumn, StatColumnOptions } from "./types";

/**
 * Builds a column for a registry stat: header, title, alignment, sort direction and
 * formatting all come from the registry, so screens only say which stat and where it lives.
 */
export function statColumn<T>(
  stat: StatKey,
  value: (row: T) => number | null | undefined,
  options: StatColumnOptions & {
    thresholds?: ThresholdOverrides;
    /** A row's source note for this stat (see `StatCell`'s `note`). */
    note?: (row: T) => string | undefined;
  } = {},
): DataColumn<T> {
  const def = getStat(stat);
  const { highlight = true, thresholds, note, ...rest } = options;
  return {
    id: stat,
    header: def.abbr,
    title: def.label,
    align: "right",
    sortable: true,
    sortDescFirst: def.better === "higher",
    searchable: false,
    value,
    cell: (row) => (
      <StatCell
        stat={stat}
        value={value(row)}
        highlight={highlight}
        thresholds={thresholds}
        note={note?.(row)}
      />
    ),
    ...rest,
  };
}

/**
 * A column for a stat from another registry (a team's season numbers): the same header, title,
 * alignment, sort direction and tabular formatting as `statColumn`, without player highlights.
 */
export function formattedColumn<T>(
  id: string,
  def: { abbr: string; label: string; format: StatFormat; better: "higher" | "lower" },
  value: (row: T) => number | null | undefined,
  options: Partial<Pick<DataColumn<T>, "group">> = {},
): DataColumn<T> {
  return {
    id,
    header: def.abbr,
    title: def.label,
    align: "right",
    sortable: true,
    sortDescFirst: def.better === "higher",
    searchable: false,
    value,
    cell: (row) => {
      const v = value(row);
      return (
        <span className={cn("num", (v === null || v === undefined) && "text-subtle-foreground")}>
          {formatValue(v, def.format)}
        </span>
      );
    },
    ...options,
  };
}

/** Splits columns into the identity column, phone-primary columns and secondary columns. */
export function partitionColumns<T>(
  columns: readonly DataColumn<T>[],
  identityId: string,
  primaryIds: readonly string[],
) {
  const identity = columns.find((c) => c.id === identityId);
  if (!identity) throw new Error(`DataTable: identity column "${identityId}" not found`);
  const primary = primaryIds
    .map((id) => columns.find((c) => c.id === id))
    .filter((c): c is DataColumn<T> => !!c && c.id !== identityId);
  const secondary = columns.filter((c) => c.id !== identityId && !primaryIds.includes(c.id));
  return { identity, primary, secondary };
}

/** Header group spans for a run of columns: adjacent columns sharing `group` merge into one cell. */
export function groupSpans<T>(columns: readonly DataColumn<T>[]): { label: string; span: number }[] {
  const spans: { label: string; span: number }[] = [];
  for (const col of columns) {
    const label = col.group ?? "";
    const last = spans[spans.length - 1];
    if (last && last.label === label) last.span++;
    else spans.push({ label, span: 1 });
  }
  return spans;
}
