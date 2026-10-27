import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { groupSpans } from "./columns";
import type { Density } from "./TableOptions";
import type { DataColumn } from "./types";

type TableGridProps<T> = {
  identity: DataColumn<T>;
  columns: readonly DataColumn<T>[];
  /** Phone mode: columns shown in each row's expansion card. Empty disables expansion. */
  detailColumns: readonly DataColumn<T>[];
  rows: readonly T[] | null;
  getRowId: (row: T) => string;
  totals?: T;
  sortState: (id: string) => false | "asc" | "desc";
  onSort: (id: string) => void;
  onRowClick?: (row: T) => void;
  density: Density;
  compact: boolean;
  loadingRows: number;
  empty: ReactNode;
  caption?: string;
  /** The element the table scrolls in, for virtualizing long tables. */
  scrollElement: () => HTMLElement | null;
};

/** Tables longer than this render only the rows in view (plus a margin). */
const VIRTUAL_MIN_ROWS = 120;

const alignClass = { left: "text-left", right: "text-right", center: "text-center" } as const;

function render<T>(col: DataColumn<T>, row: T): ReactNode {
  if (col.cell) return col.cell(row);
  const value = col.value(row);
  return value === null || value === undefined || value === "" ? (
    <span className="text-subtle-foreground">—</span>
  ) : (
    value
  );
}

/** The table itself: sticky header, pinned identity column, groups, expansion and totals. */
export function TableGrid<T>(props: TableGridProps<T>) {
  const {
    identity,
    columns,
    detailColumns,
    rows,
    getRowId,
    totals,
    sortState,
    onSort,
    onRowClick,
    density,
    compact,
  } = props;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const all = [identity, ...columns];
  const hasGroups = columns.some((c) => c.group);
  const expandable = compact && detailColumns.length > 0;
  const rowHeight = compact ? "h-11" : density === "compact" ? "h-9" : "h-11";
  const pin = "sticky left-0 z-10 bg-surface group-hover/row:bg-surface-2";

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const header = (col: DataColumn<T>, index: number) => {
    const sorted = sortState(col.id);
    const sortable = col.sortable !== false;
    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
    return (
      <th
        key={col.id}
        scope="col"
        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
        title={col.title}
        style={{ minWidth: col.minWidth }}
        className={cn(
          "h-9 border-b border-border bg-surface px-3 text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-muted-foreground uppercase",
          alignClass[col.align ?? "left"],
          index === 0 && "sticky left-0 z-30",
          sorted && "text-foreground",
        )}
      >
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort(col.id)}
            className={cn(
              "inline-flex items-center gap-1 hover:text-foreground pointer-coarse:touch-target",
              col.align === "right" && "flex-row-reverse",
            )}
          >
            {col.header}
            <Icon className={cn("size-3", !sorted && "opacity-30")} />
          </button>
        ) : (
          col.header
        )}
      </th>
    );
  };

  const cells = (row: T, isTotals = false) =>
    all.map((col, index) => (
      <td
        key={col.id}
        className={cn(
          "border-b border-border px-3 whitespace-nowrap",
          rowHeight,
          alignClass[col.align ?? "left"],
          index === 0 && pin,
          isTotals && "border-t-2 border-b-0 border-t-border-strong bg-surface-2 font-semibold",
        )}
      >
        {index === 0 ? (
          // On phones the identity column is capped so the primary stats stay on screen.
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              compact && "max-w-[min(12rem,52cqw)] overflow-hidden",
            )}
          >
            {expandable && !isTotals && (
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-subtle-foreground transition-transform",
                  expanded.has(getRowId(row)) && "rotate-180",
                )}
              />
            )}
            {render(col, row)}
          </span>
        ) : (
          render(col, row)
        )}
      </td>
    ));

  const virtual = rows !== null && rows.length > VIRTUAL_MIN_ROWS;
  // TanStack Virtual returns fresh functions each render by design; this component re-renders on
  // every scroll anyway, so skipping the compiler's memoization here costs nothing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: props.scrollElement,
    estimateSize: () => (rowHeight === "h-9" ? 36 : 44),
    overscan: 12,
    getItemKey: (index) => (rows?.[index] ? getRowId(rows[index]) : index),
  });
  const items = virtualizer.getVirtualItems();

  const renderRow = (row: T) => {
    const id = getRowId(row);
    const open = expandable && expanded.has(id);
    const clickable = expandable || !!onRowClick;
    return (
      <Fragment key={id}>
        <tr
          className={cn("group/row transition-colors hover:bg-surface-2", clickable && "cursor-pointer")}
          onClick={clickable ? () => (expandable ? toggle(id) : onRowClick?.(row)) : undefined}
          aria-expanded={expandable ? open : undefined}
        >
          {cells(row)}
        </tr>
        {open && (
          <tr className="bg-surface-2/60">
            <td colSpan={all.length} className="border-b border-border px-3 py-3">
              <dl className="sticky left-3 grid w-[calc(100cqw-3.5rem)] grid-cols-2 gap-x-4 gap-y-2.5">
                {detailColumns.map((col) => (
                  <div
                    key={col.id}
                    className="flex items-baseline justify-between gap-2 border-b border-border/60 pb-1.5 whitespace-normal"
                  >
                    <dt className="text-xs leading-tight text-muted-foreground">{col.title ?? col.header}</dt>
                    <dd className="shrink-0 text-[13px] font-medium">{render(col, row)}</dd>
                  </div>
                ))}
              </dl>
              {onRowClick && (
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="sticky left-3 mt-3 text-sm font-medium text-primary"
                >
                  Open
                </button>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  return (
    <table className="w-full border-separate border-spacing-0 text-[13px] @tablet:text-sm">
      {props.caption && <caption className="sr-only">{props.caption}</caption>}
      <thead className="sticky top-0 z-20">
        {hasGroups && (
          <tr>
            {groupSpans(all).map((g, i) => (
              <th
                key={`${g.label}-${i}`}
                colSpan={g.span}
                className={cn(
                  "h-7 bg-surface px-3 text-left text-[10px] font-bold tracking-[0.12em] text-subtle-foreground uppercase",
                  g.label && "border-b border-border",
                  i === 0 && "sticky left-0 z-30",
                )}
              >
                {g.label}
              </th>
            ))}
          </tr>
        )}
        <tr>{all.map(header)}</tr>
      </thead>
      <tbody className="num">
        {rows === null &&
          Array.from({ length: props.loadingRows }, (_, i) => (
            <tr key={i}>
              {all.map((col) => (
                <td key={col.id} className={cn("border-b border-border px-3", rowHeight)}>
                  <Skeleton className={cn("h-3.5", col.id === identity.id ? "w-32" : "ml-auto w-10")} />
                </td>
              ))}
            </tr>
          ))}
        {rows?.length === 0 && (
          <tr>
            <td colSpan={all.length} className="p-4">
              {props.empty}
            </td>
          </tr>
        )}
        {!virtual && rows?.map((row) => renderRow(row))}
      </tbody>
      {virtual && rows && (
        <>
          <tbody aria-hidden>
            <tr style={{ height: items[0]?.start ?? 0 }} />
          </tbody>
          {items.map((item) => {
            const row = rows[item.index];
            return row === undefined ? null : (
              <tbody key={item.key} ref={virtualizer.measureElement} data-index={item.index} className="num">
                {renderRow(row)}
              </tbody>
            );
          })}
          <tbody aria-hidden>
            <tr style={{ height: virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0) }} />
          </tbody>
        </>
      )}
      {totals && rows && rows.length > 0 && (
        <tfoot className="num sticky bottom-0 z-20">
          <tr>{cells(totals, true)}</tr>
        </tfoot>
      )}
    </table>
  );
}
