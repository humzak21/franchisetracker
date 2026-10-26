import * as Checkbox from "@radix-ui/react-checkbox";
import { ArrowDown, ArrowUp, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import type { DataColumn } from "./types";

export type Density = "compact" | "comfortable";

type TableOptionsProps<T> = {
  /** Columns the user can toggle (everything except identity). */
  columns: readonly DataColumn<T>[];
  /** Ids currently checked: phone = promoted to primary, desktop = visible. */
  checked: ReadonlySet<string>;
  onToggle: (id: string) => void;
  mode: "phone" | "desktop";
  sort?: { id: string; desc: boolean };
  onSort?: (id: string, desc: boolean) => void;
  density?: Density;
  onDensity?: (density: Density) => void;
  onReset: () => void;
};

/** Column picker, sort controls and density. Rendered in a BottomSheet on phones, a popover on desktop. */
export function TableOptions<T>({
  columns,
  checked,
  onToggle,
  mode,
  sort,
  onSort,
  density,
  onDensity,
  onReset,
}: TableOptionsProps<T>) {
  const sortable = columns.filter((c) => c.sortable !== false);
  return (
    <div className="space-y-5">
      {mode === "phone" && onSort && (
        <section>
          <h4 className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Sort by
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {sortable.map((col) => {
              const active = sort?.id === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onSort(col.id, active ? !sort.desc : (col.sortDescFirst ?? false))}
                  className={cn(
                    "inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm",
                    active
                      ? "border-primary bg-elite-1 text-primary"
                      : "border-border-strong text-muted-foreground",
                  )}
                >
                  {col.title ?? col.header}
                  {active &&
                    (sort.desc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />)}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {mode === "desktop" && density && onDensity && (
        <section className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Density
          </h4>
          <Segmented
            size="sm"
            value={density}
            onChange={onDensity}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
          />
        </section>
      )}
      <section>
        <h4 className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          {mode === "phone" ? "Columns in the table" : "Visible columns"}
        </h4>
        {mode === "phone" && (
          <p className="mb-2 text-xs text-muted-foreground">
            Unchecked columns stay one tap away in each row.
          </p>
        )}
        <ul className="grid grid-cols-1 gap-0.5 @md:grid-cols-2">
          {columns.map((col) => (
            <li key={col.id}>
              <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
                <Checkbox.Root
                  checked={checked.has(col.id)}
                  onCheckedChange={() => onToggle(col.id)}
                  className="grid size-5 shrink-0 place-items-center rounded-[5px] border border-border-strong data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                >
                  <Checkbox.Indicator>
                    <Check className="size-3.5" strokeWidth={3} />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <span className="text-sm">{col.title ?? col.header}</span>
                {col.title && <span className="ml-auto text-xs text-subtle-foreground">{col.header}</span>}
              </label>
            </li>
          ))}
        </ul>
      </section>
      <Button variant="ghost" size="sm" onClick={onReset}>
        <RotateCcw /> Reset to defaults
      </Button>
    </div>
  );
}
