import { formatRank } from "@shared/stats";
import { cn } from "@/lib/cn";

export const LEAGUE_SIZE = 32;

export type RankTone = "top" | "good" | "mid" | "poor" | "bottom";

/** Rank buckets: 1st, top quarter, middle, bottom quarter, last. */
export function rankTone(rank: number, of = LEAGUE_SIZE): RankTone {
  if (rank === 1) return "top";
  if (rank <= Math.ceil(of / 4)) return "good";
  if (rank === of) return "bottom";
  if (rank > of - Math.ceil(of / 4)) return "poor";
  return "mid";
}

export const rankToneClass: Record<RankTone, string> = {
  top: "bg-elite-2 text-elite-2-foreground",
  good: "bg-win/15 text-win",
  mid: "bg-surface-2 text-muted-foreground",
  poor: "bg-loss/12 text-loss",
  bottom: "bg-loss text-white",
};

export function RankBadge({
  rank,
  tied,
  of = LEAGUE_SIZE,
  className,
}: {
  rank: number;
  tied?: boolean;
  of?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num inline-flex h-5 min-w-9 items-center justify-center rounded-md px-1.5 text-[11px] font-bold",
        rankToneClass[rankTone(rank, of)],
        className,
      )}
    >
      {formatRank(rank, tied)}
    </span>
  );
}
