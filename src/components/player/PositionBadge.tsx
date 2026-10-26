import { isPosition, sideOf } from "@shared/domain";
import { cn } from "@/lib/cn";

const sideClass = {
  offense: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  defense: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  special: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
} as const;

export function PositionBadge({ position, className }: { position: string; className?: string }) {
  const side = isPosition(position) ? sideOf(position) : "special";
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[10px] font-bold tracking-wide",
        sideClass[side],
        className,
      )}
    >
      {position}
    </span>
  );
}
