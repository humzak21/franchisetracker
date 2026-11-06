/**
 * Resolves a printed player name against known players: the name fit (`./nameMatch`) first, then
 * where each player is this season. A box score only holds the two teams that played, a name on a
 * team's line is usually someone on that team, and a player on no roster this season is rarely
 * who a screen means. Pure; Convex supplies the candidates and their rosters.
 */
import { isPosition, positionGroupOf } from "../domain/positions";
import { nameFit, nameForms, nameTokens, type NameForm } from "./nameMatch";
import type { MatchCandidate, PlayerMatch } from "./types";

export type NameCandidate<P extends string = string> = {
  playerId: P;
  displayName: string;
  firstName: string;
  lastName: string;
  aliases: readonly string[];
  /** The team they are rostered on this season, when the lookup knows. */
  teamAbbr?: string | null;
  position?: string | null;
  /** Released or traded away this season: still possible, but the last place to look. */
  inactive?: boolean;
  /** On some team's roster this season; false only when the league's rosters are in and they are on none. */
  inLeague?: boolean;
  /** The team they were rostered on last season. */
  lastTeamAbbr?: string | null;
};

/** What the screen says about who the name is. */
export type MatchHint = {
  teamAbbr?: string | null;
  position?: string | null;
  /** The two teams of the game the name was printed in: nobody else played in it. */
  gameTeams?: readonly string[];
};

const MATCH_SCORE = 0.9;
const AMBIGUOUS_SCORE = 0.72;
/** A name fit below this is someone else, whatever their team. */
const CANDIDATE_FLOOR = 0.6;
/** A runner-up this close to the best makes the match ambiguous. */
const CLEAR_MARGIN = 0.06;
/**
 * A surname read badly ("K.Bolden" for Kayshon Boutte) is offered only from the roster the name
 * was printed on, and only for review: it starts below a settled match whatever its context.
 */
const MISREAD_FIT = 0.7;
const MISREAD_SCORE = 0.66;

/** Each way the player's name is written: the display name, the legal name, and printings seen before. */
export function candidateForms(c: Omit<NameCandidate, "playerId">): NameForm[] {
  const legal = nameTokens(`${c.firstName} ${c.lastName}`);
  const named = [
    nameForms(c.displayName, c.lastName),
    ...(legal.length > 0 ? [nameForms(`${c.firstName} ${c.lastName}`, c.lastName)] : []),
  ];
  // A printing like "J.Reed" stands for Jaylen, not for every J: once a first name is known in
  // full, an alias's initial matches only through it.
  const full = named.flatMap((f) => f.firsts).filter((f) => f.length > 2);
  const aliases = c.aliases.map((alias) => {
    const form = nameForms(alias, c.lastName);
    return full.length > 0 && form.firsts.every((f) => f.length <= 2) ? { ...form, firsts: full } : form;
  });
  return [...named, ...aliases];
}

const SPECIALISTS = new Set(["K", "P"]);

/** A kicking line is a kicker's: a cornerback named like him is not who kicked. */
function positionFit(hint: string | null | undefined, position: string | null | undefined): number {
  if (!hint || !position || !isPosition(hint) || !isPosition(position)) return 0;
  if (hint === position) return 0.03;
  if (positionGroupOf(hint) === positionGroupOf(position)) return 0.02;
  return SPECIALISTS.has(hint) !== SPECIALISTS.has(position) ? -0.15 : -0.04;
}

/** Active on the team the name was printed for, or on one of the game's teams when no team was. */
function onPrintedRoster(c: NameCandidate, hint: MatchHint): boolean {
  if (c.inactive || !c.teamAbbr) return false;
  return hint.teamAbbr ? c.teamAbbr === hint.teamAbbr : (hint.gameTeams ?? []).includes(c.teamAbbr);
}

/** How much where the player is this season agrees with where the name was printed. */
export function contextScore(c: NameCandidate, hint: MatchHint): number {
  let score = positionFit(hint.position, c.position);
  if (c.inLeague === false) score -= 0.05;
  if (c.inactive) score -= 0.04;
  const game = hint.gameTeams ?? [];
  if (c.teamAbbr) {
    const inGame = game.includes(c.teamAbbr);
    if (hint.teamAbbr && c.teamAbbr === hint.teamAbbr) score += c.inactive ? 0.02 : 0.07;
    else if (hint.teamAbbr) score -= inGame ? 0.02 : 0.06;
    else if (game.length > 0) score += inGame ? 0.05 : -0.06;
  }
  if (hint.teamAbbr && c.teamAbbr !== hint.teamAbbr && c.lastTeamAbbr === hint.teamAbbr) score += 0.03;
  return score;
}

/** Scores every candidate on name and context and decides the match status. */
export function matchPlayer<P extends string>(
  printed: string,
  candidates: readonly NameCandidate<P>[],
  hint: MatchHint = {},
): PlayerMatch<P> {
  const scored: MatchCandidate<P>[] = [];
  for (const c of candidates) {
    const fit = nameFit(printed, candidateForms(c));
    const name = fit.sameSurname ? fit.score : MISREAD_SCORE;
    if (fit.sameSurname ? fit.score < CANDIDATE_FLOOR : fit.score < MISREAD_FIT || !onPrintedRoster(c, hint))
      continue;
    scored.push({ playerId: c.playerId, name: c.displayName, score: name + contextScore(c, hint) });
  }
  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  const top = scored.slice(0, 5).map((c) => ({ ...c, score: Math.max(0, Math.min(1, c.score)) }));
  if (!best || best.score < AMBIGUOUS_SCORE) return { status: "new", candidates: top };
  const clear = !second || best.score - second.score >= CLEAR_MARGIN;
  return { status: best.score >= MATCH_SCORE && clear ? "matched" : "ambiguous", candidates: top };
}
