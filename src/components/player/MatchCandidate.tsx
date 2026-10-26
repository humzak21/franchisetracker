import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Headshot } from "./Headshot";

export type MatchCandidateLike = {
  name: string;
  position: string | null;
  teamAbbr: string | null;
  college: string | null;
  age: number | null;
  headshotUrl: string | null;
};

/** A possible real-world match for a player (an ESPN athlete): face, name and the facts that tell people apart. */
export function MatchCandidate({
  candidate,
  action,
  className,
}: {
  candidate: MatchCandidateLike;
  action?: ReactNode;
  className?: string;
}) {
  const facts = [
    candidate.position,
    candidate.teamAbbr,
    candidate.college,
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
        <div className="truncate font-medium">{candidate.name}</div>
        <div className="truncate text-xs text-muted-foreground">{facts.join(" · ") || "No details"}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
