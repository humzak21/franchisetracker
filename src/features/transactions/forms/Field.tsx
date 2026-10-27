import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A labelled form control in the move sheets. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0 space-y-1", className)}>
      <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
