import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type DisclosureProps = {
  title: ReactNode;
  /** How many items are tucked inside, shown beside the title. */
  count?: number;
  children: ReactNode;
  className?: string;
};

/**
 * A closed-by-default group for what a screen keeps out of the way (awards nobody has won yet).
 * Native `details`, so it opens with the keyboard and screen readers announce its state.
 */
export function Disclosure({ title, count, children, className }: DisclosureProps) {
  return (
    <details className={cn("group rounded-xl border border-dashed border-border-strong", className)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 shrink-0 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {count !== undefined && (
          <span className="num rounded-full bg-surface-2 px-2 py-0.5 text-xs text-subtle-foreground">
            {count}
          </span>
        )}
      </summary>
      <div className="border-t border-dashed border-border-strong p-3">{children}</div>
    </details>
  );
}
