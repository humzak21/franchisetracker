import type { ReactNode } from "react";
import { AWARD_INFO } from "@shared/domain";
import { TeamChip } from "@/components/team/TeamChip";
import { cn } from "@/lib/cn";
import type { AwardWinner } from "./types";
import { WinnerChip } from "./WinnerChip";

/** One winner: the award, the player (linked when known), their team and the stat line. User-team winners stand out. */
export function AwardCard({
  award,
  label,
  action,
}: {
  award: AwardWinner;
  label?: string;
  /** A control in the card's header, after the team (removing a team award, assigning a winner). */
  action?: ReactNode;
}) {
  const title = label ?? award.customName ?? AWARD_INFO[award.type].label;
  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-3",
        award.isUser ? "border-primary/60 bg-elite-1" : "border-border",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          {title}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {award.team && <TeamChip team={award.team} label="abbr" size="xs" className="text-xs" />}
          {action}
        </span>
      </div>
      <WinnerChip award={award} />
    </article>
  );
}
