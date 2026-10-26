import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

type SelectProps = Omit<ComponentProps<"select">, "onChange"> & {
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  /** Shown as an unselectable first option while nothing is chosen. */
  placeholder?: string;
};

/**
 * A native select styled like `Input`. Native on purpose: phones open their own wheel or sheet,
 * which beats any custom menu for one-of-many choices.
 */
export function Select({ options, onValueChange, placeholder, className, value, ...props }: SelectProps) {
  return (
    <span className={cn("relative inline-flex w-full", className)}>
      <select
        value={value ?? ""}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-surface pr-8 pl-3 text-sm text-foreground transition-colors focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:text-base"
        {...props}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </span>
  );
}
