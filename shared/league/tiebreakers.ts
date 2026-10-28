/**
 * NFL-style tiebreakers over the scored regular-season games a season knows (FEATURES.md 5.6):
 * head-to-head, division record, common games, conference record, strength of victory, strength
 * of schedule, then point differential. Teams are picked one at a time and the procedure starts
 * over for the rest, as the league does. Coin tosses and net touchdowns are not modelled; the
 * abbreviation settles a tie that survives everything else. Pure.
 */
import type { Conference } from "../domain/teams";
import { winPct } from "../stats/format";
import type { StandingDivision } from "./alignment";

export type TiebreakTeam = {
  teamAbbr: string;
  conference: Conference;
  division: StandingDivision;
  w: number;
  l: number;
  t: number;
  pointsFor?: number;
  pointsAgainst?: number;
};

/** One scored regular-season game, by abbreviation. */
export type FinalScore = { home: string; away: string; homeScore: number; awayScore: number };

type Tally = { w: number; l: number; t: number };
type Meeting = { opponent: string; outcome: 1 | 0.5 | 0 };

const pctOf = (r: Tally) => winPct(r) ?? 0;

function tally(meetings: readonly Meeting[]): Tally {
  const r = { w: 0, l: 0, t: 0 };
  for (const m of meetings) {
    if (m.outcome === 1) r.w++;
    else if (m.outcome === 0) r.l++;
    else r.t++;
  }
  return r;
}

export type Tiebreaker = {
  /** Orders a division best first. */
  division: (teams: readonly string[]) => string[];
  /**
   * Orders conference teams best first, one pick at a time; on a tie only the best-ranked team
   * of each division stays in the running (`divisionRank`).
   */
  conference: (teams: readonly string[], divisionRank: (team: string) => number) => string[];
  pct: (team: string) => number;
};

export function tiebreaker(rows: readonly TiebreakTeam[], games: readonly FinalScore[]): Tiebreaker {
  const byTeam = new Map(rows.map((r) => [r.teamAbbr, r]));
  const meetings = new Map<string, Meeting[]>();
  const meet = (team: string, opponent: string, scored: number, allowed: number) => {
    const outcome = scored > allowed ? 1 : scored < allowed ? 0 : 0.5;
    meetings.set(team, [...(meetings.get(team) ?? []), { opponent, outcome }]);
  };
  for (const g of games) {
    meet(g.home, g.away, g.homeScore, g.awayScore);
    meet(g.away, g.home, g.awayScore, g.homeScore);
  }
  const of = (team: string) => meetings.get(team) ?? [];
  const pct = (team: string) => {
    const r = byTeam.get(team);
    return r ? pctOf(r) : 0;
  };
  const sameDivision = (a: string, b: string) =>
    byTeam.get(a)?.conference === byTeam.get(b)?.conference &&
    byTeam.get(a)?.division === byTeam.get(b)?.division;
  const sameConference = (a: string, b: string) => byTeam.get(a)?.conference === byTeam.get(b)?.conference;
  const pctVs = (team: string, keep: (opponent: string) => boolean) =>
    pctOf(tally(of(team).filter((m) => keep(m.opponent))));
  const combined = (opponents: readonly string[]) => {
    const sum = { w: 0, l: 0, t: 0 };
    for (const o of opponents) {
      const r = byTeam.get(o);
      if (r) Object.assign(sum, { w: sum.w + r.w, l: sum.l + r.l, t: sum.t + r.t });
    }
    return pctOf(sum);
  };
  const sov = (team: string) =>
    combined(
      of(team)
        .filter((m) => m.outcome === 1)
        .map((m) => m.opponent),
    );
  const sos = (team: string) => combined(of(team).map((m) => m.opponent));
  const diff = (team: string) => (byTeam.get(team)?.pointsFor ?? 0) - (byTeam.get(team)?.pointsAgainst ?? 0);

  /** The keys a tied group is compared on, in order; higher is better. */
  const keys = (tied: readonly string[], kind: "division" | "conference") => {
    const everyoneMet = tied.every((a) => tied.every((b) => a === b || of(a).some((m) => m.opponent === b)));
    const common = tied
      .map((t) => new Set(of(t).map((m) => m.opponent)))
      .reduce((a, b) => new Set([...a].filter((o) => b.has(o))));
    // The conference tiebreaker reads common games only with at least four of them.
    const useCommon = kind === "division" || common.size >= 4;
    return (team: string): number[] => [
      everyoneMet ? pctVs(team, (o) => tied.includes(o)) : 0,
      kind === "division" ? pctVs(team, (o) => sameDivision(team, o)) : 0,
      useCommon ? pctVs(team, (o) => common.has(o)) : 0,
      pctVs(team, (o) => sameConference(team, o)),
      sov(team),
      sos(team),
      diff(team),
    ];
  };

  const best = (tied: readonly string[], kind: "division" | "conference") => {
    if (tied.length === 1) return tied[0]!;
    const key = keys(tied, kind);
    const scored = tied.map((t) => ({ t, k: key(t) }));
    scored.sort((a, b) => {
      for (let i = 0; i < a.k.length; i++) {
        const d = b.k[i]! - a.k[i]!;
        if (d !== 0) return d;
      }
      return a.t.localeCompare(b.t);
    });
    return scored[0]!.t;
  };

  const order = (
    teams: readonly string[],
    kind: "division" | "conference",
    eligible: (tied: readonly string[]) => string[],
  ) => {
    const out: string[] = [];
    let pool = [...teams];
    while (pool.length > 0) {
      const top = Math.max(...pool.map(pct));
      const tied = eligible(pool.filter((t) => pct(t) === top));
      const pick = best(tied, kind);
      out.push(pick);
      pool = pool.filter((t) => t !== pick);
    }
    return out;
  };

  return {
    pct,
    division: (teams) => order(teams, "division", (tied) => [...tied]),
    conference: (teams, divisionRank) =>
      order(teams, "conference", (tied) =>
        tied.filter(
          (t) => !tied.some((o) => o !== t && sameDivision(o, t) && divisionRank(o) < divisionRank(t)),
        ),
      ),
  };
}
