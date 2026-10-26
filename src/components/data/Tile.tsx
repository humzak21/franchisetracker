import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type TileProps = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Emphasize with the team accent (the headline number of a strip). */
  accent?: boolean;
  className?: string;
};

/** One headline number with a label: season summary strips, dashboard cards, trophy counts. */
export function Tile({ label, value, detail, accent, className }: TileProps) {
  return (
    <div className={cn("min-w-0 rounded-xl border border-border bg-surface px-4 py-3", className)}>
      <div className="truncate text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {label}
      </div>
      <div
        className={cn(
          "num mt-1 truncate font-display text-3xl leading-none font-bold",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
      {detail && <div className="mt-1.5 truncate text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

/** A row of tiles that wraps to two columns on phones. */
export function TileStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("@container grid grid-cols-2 gap-2 @tablet:grid-cols-4", className)}>{children}</div>
  );
}
