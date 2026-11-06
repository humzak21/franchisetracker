import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Select, type SelectOption } from "./select";
import { cn } from "@/lib/cn";

/**
 * A select with previous and next buttons beside it, for flicking through a list one step at a
 * time (a chart's stat) without opening the menu. The buttons stop at either end.
 */
export function StepSelect({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
}) {
  const at = options.findIndex((o) => o.value === value);
  const step = (by: number) => {
    const next = options[at + by];
    if (next) onValueChange(next.value);
  };
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Previous ${ariaLabel.toLowerCase()}`}
        disabled={at <= 0}
        onClick={() => step(-1)}
      >
        <ChevronLeft />
      </Button>
      <Select
        className="min-w-0 flex-1"
        aria-label={ariaLabel}
        value={value}
        onValueChange={onValueChange}
        options={options}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Next ${ariaLabel.toLowerCase()}`}
        disabled={at === -1 || at >= options.length - 1}
        onClick={() => step(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
