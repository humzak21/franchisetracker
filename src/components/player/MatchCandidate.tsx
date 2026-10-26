import type { ReactNode } from "react";
import { ESPN_LEAGUE_LABELS, type EspnLeague } from "@shared/players/espnMatch";
import { cn } from "@/lib/cn";
import { Badge } from "../ui/misc";
import { Headshot } from "./Headshot";

export type MatchCandidateLike = {
  name: string;
  league: EspnLeague;
  position: string | null;
  /** NFL team, or the school's abbreviation for a college player. */
  teamAbbr: string | null;
  college: string | null;
  classYear: string | null;
  age: number | null;
  headshotUrl: string | null;
};

/**
 * A possible real-world match for a player (an ESPN athlete, pro or college): face, name, league
 * and the facts that tell namesakes apart.
 */
export function MatchCandidate({
  candidate,
  action,
  className,
}: {
  candidate: MatchCandidateLike;
  action?: ReactNode;
  className?: string;
}) {
  const college = candidate.league === "college";
  const facts = [
    candidate.position,
    // A college player's team is his school; name it once.
    college ? null : candidate.teamAbbr,
    candidate.college,
    candidate.classYear,
    candidate.age === null ? null : `age ${candidate.age}`,
  ].filter(Boolean);
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface p-2.5",
        className,
      )}
    >
      <Headshot name={candidate.name} src={candidate.headshotUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium">{candidate.name}</span>
          <Badge tone={college ? "accent" : "neutral"} className="shrink-0">
            {ESPN_LEAGUE_LABELS[candidate.league]}
          </Badge>
        </div>
        <div className="truncate text-xs text-muted-foreground">{facts.join(" · ") || "No details"}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
