import { isPosition, positionColor, type PositionColor } from "@shared/domain";
import { cn } from "@/lib/cn";

/** Literal classes so Tailwind sees every one; keyed by `POSITION_COLORS`. */
const colorClass: Record<PositionColor, string> = {
  qb: "bg-pos-qb/15 text-pos-qb",
  hb: "bg-pos-hb/15 text-pos-hb",
  fb: "bg-pos-fb/15 text-pos-fb",
  wr: "bg-pos-wr/15 text-pos-wr",
  te: "bg-pos-te/15 text-pos-te",
  ol: "bg-pos-ol/15 text-pos-ol",
  edge: "bg-pos-edge/15 text-pos-edge",
  dt: "bg-pos-dt/15 text-pos-dt",
  lb: "bg-pos-lb/15 text-pos-lb",
  cb: "bg-pos-cb/15 text-pos-cb",
  s: "bg-pos-s/15 text-pos-s",
  k: "bg-pos-k/15 text-pos-k",
  p: "bg-pos-p/15 text-pos-p",
  ls: "bg-pos-ls/15 text-pos-ls",
};

export function PositionBadge({ position, className }: { position: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[10px] font-bold tracking-wide",
        isPosition(position) ? colorClass[positionColor(position)] : "bg-surface-3 text-muted-foreground",
        className,
      )}
    >
      {position}
    </span>
  );
}
