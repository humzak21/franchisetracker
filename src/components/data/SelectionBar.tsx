import type { ReactNode } from "react";
import { X } from "lucide-react";
import { SelectBox } from "@/components/ui/SelectBox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Batch actions over picked rows: a select-all box with the count, the actions, and a way to
 * clear. Screens pin it under their header while anything is picked, so it stays in reach.
 */
export function SelectionBar({
  count,
  total,
  state,
  onToggleAll,
  onClear,
  noun = "player",
  children,
  className,
}: {
  count: number;
  total: number;
  state: boolean | "mixed";
  onToggleAll: () => void;
  onClear: () => void;
  noun?: string;
  children?: ReactNode;
  className?: string;
}) {
  const label = state === true ? "Deselect all" : `Select all ${total}`;
  return (
    <div
      role="toolbar"
      aria-label="Selection"
      data-swipe-ignore
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2",
        count > 0 && "border-primary/50",
        className,
      )}
    >
      <SelectBox checked={state} onChange={onToggleAll} label={label} disabled={total === 0} />
      <button
        type="button"
        onClick={onToggleAll}
        disabled={total === 0}
        className="text-sm font-medium hover:underline disabled:opacity-50 pointer-coarse:touch-target"
      >
        {label}
      </button>
      <span className="num text-sm text-muted-foreground">
        {count > 0 ? `${count} ${noun}${count === 1 ? "" : "s"} selected` : `Pick ${noun}s for a batch move`}
      </span>
      {count > 0 && (
        <span className="ml-auto flex flex-wrap items-center gap-2">
          {children}
          <Button size="icon-sm" variant="ghost" aria-label="Clear selection" onClick={onClear}>
            <X />
          </Button>
        </span>
      )}
    </div>
  );
}
