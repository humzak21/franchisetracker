import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { AWARD_INFO } from "@shared/domain";
import { Headshot } from "@/components/player/Headshot";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamLogo } from "@/components/team/TeamLogo";
import { cn } from "@/lib/cn";
import type { AwardWinner } from "./types";

/** A league-wide award (MVP, Coach of the Year) given the room it deserves: big portrait, name, team, line. */
export function HeroAward({ award, action }: { award: AwardWinner; action?: ReactNode }) {
  const { label, coach } = AWARD_INFO[award.type];
  const name = (
    <span className="block truncate font-display text-2xl leading-none font-bold tracking-wide uppercase @desktop:text-3xl">
      {award.name}
    </span>
  );
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-surface p-4 pl-5",
        award.isUser ? "border-primary/60 bg-elite-1" : "border-border",
      )}
    >
      {/* Team colors are data, so they come in as a style rather than a token. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: award.team?.primaryColor ?? "var(--border-strong)" }}
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
          <Trophy className="size-3.5 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {action}
      </div>
      <div className="flex items-center gap-3.5">
        {award.player ? (
          <Headshot
            name={award.name}
            src={award.player.headshotUrl}
            team={award.team ?? undefined}
            size="lg"
          />
        ) : award.team ? (
          <TeamLogo team={award.team} size="lg" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          {award.player ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: award.player._id }}
              className="block hover:underline"
            >
              {name}
            </Link>
          ) : (
            name
          )}
          <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            {award.player && <PositionBadge position={award.player.position} />}
            <span className="truncate">
              {award.team ? `${award.team.city} ${award.team.name}` : coach ? "Head coach" : null}
              {coach && award.team ? " · Head coach" : null}
            </span>
          </span>
          {award.statLine && <span className="num block truncate text-sm">{award.statLine}</span>}
        </div>
      </div>
    </article>
  );
}
