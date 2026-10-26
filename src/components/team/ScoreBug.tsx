import { cn } from "@/lib/cn";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { TeamLogo, type TeamLike } from "./TeamLogo";

export type ScoreBugSide = { team: TeamLike; score: number | null; record?: string };

type ScoreBugProps = {
  away: ScoreBugSide;
  home: ScoreBugSide;
  /** "Final", "W7", "Super Bowl", "Q3 4:12"... */
  status: string;
  overtime?: boolean;
  /** Team abbr to emphasize as "ours"; its result colors the status chip. */
  userTeam?: string;
  className?: string;
};

function Score({ value, dim }: { value: number | null; dim: boolean }) {
  const shown = useCountUp(value ?? 0);
  return (
    <span
      className={cn(
        "num font-display text-4xl leading-none font-bold @tablet:text-5xl",
        dim && "text-muted-foreground",
      )}
    >
      {value === null ? "–" : shown}
    </span>
  );
}

function Row({ side, won, decided }: { side: ScoreBugSide; won: boolean; decided: boolean }) {
  return (
    <div className="relative flex items-center gap-3 py-2 pr-4 pl-4">
      <span
        aria-hidden
        className="absolute inset-y-1 left-0 w-1 rounded-r"
        style={{ background: side.team.primaryColor }}
      />
      <TeamLogo team={side.team} size="md" />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "font-display text-xl leading-none font-semibold tracking-wide uppercase",
            decided && !won && "text-muted-foreground",
          )}
        >
          {side.team.name ?? side.team.abbr}
        </div>
        {side.record && <div className="num mt-1 text-xs text-muted-foreground">{side.record}</div>}
      </div>
      <Score value={side.score} dim={decided && !won} />
    </div>
  );
}

/** Broadcast-style score bug. Built for phone width (stacked rows) and widens to a single strip. */
export function ScoreBug({ away, home, status, overtime, userTeam, className }: ScoreBugProps) {
  const decided = away.score !== null && home.score !== null;
  const awayWon = decided && away.score! > home.score!;
  const homeWon = decided && home.score! > away.score!;
  const user = userTeam === away.team.abbr ? "away" : userTeam === home.team.abbr ? "home" : null;
  const result =
    !decided || !user ? null : awayWon === homeWon ? "T" : (user === "away") === awayWon ? "W" : "L";

  const statusChip = (
    <div className="flex items-center gap-1.5">
      {result && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-bold",
            { W: "bg-win text-black", L: "bg-loss text-white", T: "bg-tie text-black" }[result],
          )}
        >
          {result}
        </span>
      )}
      <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {status}
      </span>
      {overtime && <span className="rounded bg-ot/15 px-1.5 py-0.5 text-[11px] font-bold text-ot">OT</span>}
    </div>
  );

  return (
    <div className={cn("@container overflow-hidden rounded-xl border border-border bg-surface", className)}>
      {/* Phone: stacked rows. */}
      <div className="@tablet:hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">{statusChip}</div>
        <Row side={away} won={awayWon} decided={decided} />
        <div className="mx-4 border-t border-border" />
        <Row side={home} won={homeWon} decided={decided} />
      </div>
      {/* Tablet and up: one strip, away left, home right. */}
      <div className="hidden grid-cols-[1fr_auto_1fr] items-center @tablet:grid">
        <div
          className="flex items-center justify-end gap-4 py-4 pr-6 pl-5"
          style={{ background: `linear-gradient(90deg, transparent, ${away.team.primaryColor}26)` }}
        >
          <div className="min-w-0 text-right">
            <div
              className={cn(
                "font-display text-2xl leading-none font-semibold uppercase",
                decided && !awayWon && "text-muted-foreground",
              )}
            >
              {away.team.name ?? away.team.abbr}
            </div>
            {away.record && <div className="num mt-1 text-xs text-muted-foreground">{away.record}</div>}
          </div>
          <TeamLogo team={away.team} size="lg" />
          <Score value={away.score} dim={decided && !awayWon} />
        </div>
        <div className="flex flex-col items-center gap-1 px-3">{statusChip}</div>
        <div
          className="flex items-center gap-4 py-4 pr-5 pl-6"
          style={{ background: `linear-gradient(270deg, transparent, ${home.team.primaryColor}26)` }}
        >
          <Score value={home.score} dim={decided && !homeWon} />
          <TeamLogo team={home.team} size="lg" />
          <div className="min-w-0">
            <div
              className={cn(
                "font-display text-2xl leading-none font-semibold uppercase",
                decided && !homeWon && "text-muted-foreground",
              )}
            >
              {home.team.name ?? home.team.abbr}
            </div>
            {home.record && <div className="num mt-1 text-xs text-muted-foreground">{home.record}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
