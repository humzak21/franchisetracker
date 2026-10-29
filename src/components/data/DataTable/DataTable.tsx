import { Check, Pencil, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import { EmptyState } from "../EmptyState";
import { partitionColumns } from "./columns";
import { TableGrid } from "./TableGrid";
import { TableOptions } from "./TableOptions";
import type { DataTableProps } from "./types";
import { useColumnPrefs } from "./useColumnPrefs";
import { useTableModel } from "./useTableModel";

/**
 * The one table component (FEATURES.md 7 and 9). Desktop: every visible column with groups,
 * sticky header and pinned identity column. Under 640 px of its own width: identity plus the
 * primary columns in a bounded scroll strip, with every other column in a tap-to-expand card.
 * Nothing is ever dropped; the column picker promotes columns and the choice is remembered.
 */
export function DataTable<T extends object>(props: DataTableProps<T>) {
  const { id, data, columns, getRowId, identityColumn, searchable = false, loadingRows = 6 } = props;
  const columnOptions = props.columnOptions ?? true;
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const prefs = useColumnPrefs(id, props.primaryColumns);
  const model = useTableModel({ data, columns, getRowId, initialSort: props.initialSort });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const editable = props.onEdit !== undefined && columns.some((c) => c.edit);

  const { identity, primary, secondary } = partitionColumns(columns, identityColumn, prefs.primary);
  const others = columns.filter((c) => c.id !== identity.id);
  const visible = compact ? primary : others.filter((c) => !prefs.hidden.has(c.id));
  const checked = new Set(compact ? primary.map((c) => c.id) : visible.map((c) => c.id));
  const sort = model.sorting[0];

  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [compact, visible.length]);

  const options = (
    <TableOptions
      columns={others}
      checked={checked}
      onToggle={compact ? prefs.togglePrimary : prefs.toggleHidden}
      mode={compact ? "phone" : "desktop"}
      sort={sort}
      onSort={(colId, desc) => model.setSorting([{ id: colId, desc }])}
      density={prefs.density}
      onDensity={prefs.setDensity}
      onReset={prefs.reset}
    />
  );

  return (
    <div ref={ref} className={cn("@container min-w-0", props.className)}>
      {(searchable || columnOptions || editable) && (
        <div className="mb-2 flex items-center gap-2">
          {searchable && (
            <div className="relative min-w-0 flex-1 @tablet:max-w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={model.globalFilter}
                onChange={(e) => model.setGlobalFilter(e.target.value)}
                placeholder={props.searchPlaceholder ?? "Search"}
                aria-label={props.searchPlaceholder ?? "Search"}
                className="pl-9"
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {editable && (
              <Button
                variant={editing ? "primary" : "outline"}
                size="sm"
                aria-pressed={editing}
                onClick={() => setEditing((on) => !on)}
              >
                {editing ? <Check /> : <Pencil />} {editing ? "Done" : "Edit"}
              </Button>
            )}
            {columnOptions && compact ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setOptionsOpen(true)}>
                  <SlidersHorizontal /> Sort &amp; columns
                </Button>
                <BottomSheet
                  open={optionsOpen}
                  onOpenChange={setOptionsOpen}
                  title="Sort & columns"
                  className="@container"
                >
                  {options}
                </BottomSheet>
              </>
            ) : columnOptions ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <SlidersHorizontal /> Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="@container w-80">{options}</PopoverContent>
              </Popover>
            ) : null}
          </div>
        </div>
      )}

      {/* Isolated: the sticky header, totals and first column stack inside the table, never over page bars. */}
      <div className="relative isolate overflow-hidden rounded-xl border border-border bg-surface">
        <div
          ref={scroller}
          data-swipe-ignore
          className="max-h-[var(--table-max-h,72dvh)] overflow-auto overscroll-x-contain"
        >
          <TableGrid
            identity={identity}
            columns={visible}
            detailColumns={compact ? secondary : []}
            rows={data === undefined ? null : model.rows}
            getRowId={getRowId}
            totals={props.totals}
            sortState={model.sortState}
            onSort={model.toggleSort}
            onRowClick={props.onRowClick}
            density={prefs.density}
            compact={compact}
            loadingRows={loadingRows}
            caption={props.caption}
            scrollElement={() => scroller.current}
            onEdit={editing ? props.onEdit : undefined}
            canEditRow={props.canEditRow}
            empty={
              props.emptyState ?? (
                <EmptyState icon={Search} title="Nothing here" description="No rows match." />
              )
            }
          />
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200",
            fade ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
    </div>
  );
}
