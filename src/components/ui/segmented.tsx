import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export type SegmentOption<T extends string> = { value: T; label: string; count?: number };

/**
 * Segmented control. Used for split-pane switching on phones, team toggles and view modes. Never
 * wider than its container: with more options than fit, it scrolls sideways within itself.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as T)}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full scrollbar-none overflow-x-auto rounded-lg bg-surface-2 p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            "min-w-11 flex-1 rounded-md px-3 font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[state=on]:bg-surface data-[state=on]:text-foreground data-[state=on]:shadow-sm",
            size === "sm" ? "h-7 text-xs pointer-coarse:h-11" : "h-8 text-sm pointer-coarse:h-11",
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="num ml-1.5 text-subtle-foreground">{option.count}</span>
          )}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
