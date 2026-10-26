import { ListFilter } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

export type FilterOption<T extends string> = { value: T; label: string; count?: number };

type FilterBarProps<T extends string> = {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  className?: string;
};

function Chips<T extends string>({ value, onChange, options, wrap }: FilterBarProps<T> & { wrap: boolean }) {
  return (
    <div
      role="radiogroup"
      className={cn("flex gap-1.5", wrap ? "flex-wrap" : "scrollbar-none overflow-x-auto")}
      data-swipe-ignore
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors pointer-coarse:h-10",
              active
                ? "border-primary bg-elite-1 text-primary"
                : "border-border-strong text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined && <span className="num text-xs opacity-70">{option.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A single-choice filter (position, side, phase). Inline chips when there is room; under
 * 640 px a button that opens the same chips in a bottom sheet (FEATURES.md 9 toolbar sheet).
 * It fills the width it is given and decides from that, so give it a full row or grid cell.
 */
export function FilterBar<T extends string>(props: FilterBarProps<T>) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const current = props.options.find((o) => o.value === props.value);

  return (
    <div ref={ref} className={cn("w-full min-w-0", props.className)}>
      {compact ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            aria-label={`${props.label}: ${current?.label ?? ""}`}
          >
            <ListFilter /> {current?.label ?? props.label}
          </Button>
          <BottomSheet open={open} onOpenChange={setOpen} title={props.label}>
            <Chips
              {...props}
              wrap
              onChange={(value) => {
                props.onChange(value);
                setOpen(false);
              }}
            />
          </BottomSheet>
        </>
      ) : (
        <Chips {...props} wrap={false} />
      )}
    </div>
  );
}
