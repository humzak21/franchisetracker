import type { ReactNode } from "react";
import { TeamLogo } from "@/components/team/TeamLogo";
import { cn } from "@/lib/cn";
import type { AwardWinner } from "./types";
import { WinnerChip } from "./WinnerChip";

/** One winner as a line in a conference's list: the award, who won it, their team. User-team winners stand out. */
export function AwardRow({
  award,
  label,
  action,
}: {
  award: AwardWinner;
  label: string;
  action?: ReactNode;
}) {
  return (
    <li className={cn("flex min-h-14 items-center gap-3 px-3 py-2", award.isUser && "bg-elite-1")}>
      <span className="w-20 shrink-0 text-[11px] leading-tight font-semibold tracking-[0.08em] text-subtle-foreground uppercase @tablet:w-28">
        {label}
      </span>
      <span className="flex min-w-0 flex-1">
        <WinnerChip award={award} />
      </span>
      {award.team && award.player && <TeamLogo team={award.team} size="xs" className="shrink-0" />}
      {action}
    </li>
  );
}
