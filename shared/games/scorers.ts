/**
 * Who a scoring play's player can be when the screen dropped the name: the game's box score,
 * ranked by the stat the kind of play implies, counting out those already on another play.
 */
import type { ScoringKind } from "../domain/scoring";
import { matchPlayer } from "../ingestion/nameMatch";
import type { MatchCandidate, PlayerMatch } from "../ingestion/types";
import { RAW_STATS, type RawStatKey, type StatLine } from "../stats/registry";

export type GameLine<P extends string = string> = {
  playerId: P;
  name: string;
  teamAbbr: string;
  stats: StatLine;
};

/** The box score stat that counts each kind of score; safeties and `other` have none. */
export const SCORER_STAT: Partial<Record<ScoringKind, RawStatKey>> = {
  pass_td: "recTd",
  rush_td: "rushTd",
  fg: "fgm",
  int_td: "defTd",
  fumble_td: "defTd",
  blocked_kick_td: "defTd",
  kick_return_td: "kickReturnTd",
  punt_return_td: "puntReturnTd",
};

/** "1 receiving touchdown", "2 field goals": a box score count of a kind of score. */
export function scoreCount(stat: RawStatKey, count: number): string {
  const noun =
    stat === "fgm" ? "field goal" : RAW_STATS[stat].label.toLowerCase().replace(/touchdowns$/, "touchdown");
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export type RankedPlayer<P extends string = string> = {
  playerId: P;
  name: string;
  /** Scores of this kind in the box score. */
  count: number;
  /** Of those, how many no other play has claimed. */
  open: number;
};

const rank = <P extends string>(players: RankedPlayer<P>[]) =>
  players.sort((a, b) => b.open - a.open || b.count - a.count || a.name.localeCompare(b.name));

/** The team's players with this kind of score in the box score, the unclaimed ones first. */
export function scorerCandidates<P extends string>(
  kind: ScoringKind,
  teamAbbr: string | null,
  lines: readonly GameLine<P>[],
  others: readonly { kind: ScoringKind; playerId: P | null | undefined }[],
): RankedPlayer<P>[] {
  const stat = SCORER_STAT[kind];
  if (!stat) return [];
  const claimed = new Map<P, number>();
  for (const other of others) {
    if (other.playerId && SCORER_STAT[other.kind] === stat) {
      claimed.set(other.playerId, (claimed.get(other.playerId) ?? 0) + 1);
    }
  }
  return rank(
    lines
      .filter((l) => l.teamAbbr === teamAbbr && (l.stats[stat] ?? 0) > 0)
      .map((l) => {
        const count = l.stats[stat] ?? 0;
        const open = Math.max(0, count - (claimed.get(l.playerId) ?? 0));
        return { playerId: l.playerId, name: l.name, count, open };
      }),
  );
}

/** The one player a nameless play can only be, or null while there is a real choice. */
export function onlyScorer<P extends string>(ranked: readonly RankedPlayer<P>[]): RankedPlayer<P> | null {
  const open = ranked.filter((r) => r.open > 0);
  return open.length === 1 ? (open[0] ?? null) : null;
}

/** The team's passers with a touchdown pass in the box score. */
export function passerCandidates<P extends string>(
  teamAbbr: string | null,
  lines: readonly GameLine<P>[],
): RankedPlayer<P>[] {
  return rank(
    lines
      .filter((l) => l.teamAbbr === teamAbbr && (l.stats.passTd ?? 0) > 0)
      .map((l) => ({
        playerId: l.playerId,
        name: l.name,
        count: l.stats.passTd ?? 0,
        open: l.stats.passTd ?? 0,
      })),
  );
}

/** The thrower of a touchdown: the name printed, else the team's only touchdown passer. */
export function resolvePasser<P extends string>(
  printed: string | null,
  teamAbbr: string | null,
  lines: readonly GameLine<P>[],
): P | null {
  if (printed) {
    const match = matchPlayer(
      printed,
      lines
        .filter((l) => l.teamAbbr === teamAbbr && (l.stats.passAtt ?? 0) > 0)
        .map((l) => {
          const words = l.name.trim().split(/\s+/);
          return {
            playerId: l.playerId,
            displayName: l.name,
            firstName: words.slice(0, -1).join(" "),
            lastName: words.at(-1) ?? l.name,
            aliases: [],
          };
        }),
    );
    return match.status === "matched" ? (match.candidates[0]?.playerId ?? null) : null;
  }
  const passers = passerCandidates(teamAbbr, lines);
  return passers.length === 1 ? (passers[0]?.playerId ?? null) : null;
}

const OPEN_SCORE = 0.95;
const CLAIMED_SCORE = 0.7;

/**
 * The box score's candidates as a review match, so the row's picker opens on them and a clear
 * first choice can be assigned in one tap. Null when the box score has nobody to offer.
 */
export function scorerMatch<P extends string>(ranked: readonly RankedPlayer<P>[]): PlayerMatch<P> | null {
  if (ranked.length === 0) return null;
  const candidates: MatchCandidate<P>[] = ranked.slice(0, 5).map((r) => ({
    playerId: r.playerId,
    name: r.name,
    score: r.open > 0 ? OPEN_SCORE : CLAIMED_SCORE,
  }));
  return { status: "ambiguous", candidates };
}
