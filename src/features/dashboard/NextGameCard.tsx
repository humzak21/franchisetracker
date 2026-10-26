import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { ResultBadge } from "@/components/team/ResultBadge";
import { TeamLogo } from "@/components/team/TeamLogo";
import type { NextGame } from "./types";

/**
 * The upcoming opponent (FEATURES.md 5.1): who, where, their record, and how the franchise has
 * fared against them, with the latest meeting. Links to their team page for the full history.
 */
export function NextGameCard({ next }: { next: NextGame | null }) {
  const opponent = next?.game.opponent;
  if (!next || !opponent) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Nothing scheduled"
        description="Upcoming games appear here once the schedule has them."
      />
    );
  }
  const { game, opponentRecord, headToHead } = next;
  const met = headToHead.record.w + headToHead.record.l + headToHead.record.t > 0;

  return (
    <Link
      to="/league/teams/$abbr"
      params={{ abbr: opponent.abbr.toLowerCase() }}
      className="block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:bg-surface-2"
    >
      <div
        className="flex items-center gap-4 p-4"
        style={{ background: `linear-gradient(90deg, ${opponent.primaryColor}33, transparent 70%)` }}
      >
        <TeamLogo team={opponent} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {weekLabel(game.weekKey, "long")} · {game.userIsHome === false ? "Away" : "Home"}
          </div>
          <div className="truncate font-display text-2xl leading-tight font-bold uppercase">
            {game.userIsHome === false ? "at" : "vs"} {opponent.city} {opponent.name}
          </div>
          <div className="num text-sm text-muted-foreground">
            {opponentRecord ? `${formatRecord(opponentRecord)} this season` : "Record not captured"}
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-border border-t border-border">
        <div className="px-4 py-3">
          <dt className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            All-time
          </dt>
          <dd className="num font-display text-2xl font-bold">
            {met ? formatRecord(headToHead.record) : "—"}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Last meeting
          </dt>
          <dd className="mt-1">
            {headToHead.last ? (
              <span className="flex flex-wrap items-center gap-2 text-sm">
                <ResultBadge
                  result={headToHead.last.result}
                  us={headToHead.last.us}
                  them={headToHead.last.them}
                />
                <span className="num text-muted-foreground">
                  {headToHead.last.year} {weekLabel(headToHead.last.weekKey)}
                </span>
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">First meeting</span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
