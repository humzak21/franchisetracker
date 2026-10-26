import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A one-line explanation above a view: where its numbers come from, or why some are missing. */
export function Notice({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-dashed border-border-strong bg-surface px-3.5 py-2.5 text-sm text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
