/**
 * Matching a player to an ESPN athlete in the NFL or college football. Created players in a
 * real draft class are college prospects ESPN already knows; a prospect keeps his ESPN id when
 * he reaches the NFL. Pure: Convex fetches the candidates, this ranks them.
 */
import { normalizePosition, positionGroupOf, type Position } from "../domain/positions";
import { nameTokens } from "../ingestion/nameMatch";

export const ESPN_LEAGUES = ["nfl", "college"] as const;
export type EspnLeague = (typeof ESPN_LEAGUES)[number];

/** ESPN's league slugs in API and CDN paths. */
export const ESPN_LEAGUE_SLUGS: Record<EspnLeague, string> = { nfl: "nfl", college: "college-football" };
export const ESPN_LEAGUE_LABELS: Record<EspnLeague, string> = { nfl: "NFL", college: "College" };

export type MatchSubject = {
  name: string;
  position: Position | null;
  /** School on the player record (Madden prints it for every prospect). */
  college: string | null;
  /** NFL team the player is on, when there is one. */
  teamAbbr: string | null;
};

export type RankableCandidate = {
  name: string;
  league: EspnLeague;
  position: string | null;
  teamAbbr: string | null;
  college: string | null;
};

export function sameName(a: string, b: string): boolean {
  return nameTokens(a).join(" ") === nameTokens(b).join(" ");
}

/** "Ohio St." and "Ohio State", "Miami (FL)" and "Miami": the same school. */
function school(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\bst\.?(?=\s|$)/g, "state")
    .replace(/\buniversity( of)?\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameSchool(a: string | null, b: string | null): boolean {
  return !!a && !!b && school(a) === school(b);
}

function samePositionGroup(position: Position | null, espn: string | null): boolean {
  const theirs = espn ? normalizePosition(espn) : null;
  return !!position && !!theirs && positionGroupOf(position) === positionGroupOf(theirs);
}

/** Exact name first, then the same school, position group and NFL team break ties. */
export function matchScore(subject: MatchSubject, c: RankableCandidate): number {
  return (
    (sameName(subject.name, c.name) ? 8 : 0) +
    (sameSchool(subject.college, c.college) ? 4 : 0) +
    (samePositionGroup(subject.position, c.position) ? 2 : 0) +
    (c.league === "nfl" && subject.teamAbbr !== null && c.teamAbbr === subject.teamAbbr ? 1 : 0)
  );
}

/** Candidates best first; equal scores keep ESPN's order. */
export function rankCandidates<T extends RankableCandidate>(
  subject: MatchSubject,
  candidates: readonly T[],
): T[] {
  return candidates
    .map((c, i) => ({ c, i, score: matchScore(subject, c) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * The one candidate worth suggesting without a look: an exact name, and when the player has a
 * school or position on record, agreeing with it. A bare name alone is too common to trust.
 */
export function confidentMatch<T extends RankableCandidate>(
  subject: MatchSubject,
  candidates: readonly T[],
): T | null {
  const exact = candidates.filter((c) => sameName(subject.name, c.name));
  const corroborated = exact.filter(
    (c) =>
      (subject.college === null || sameSchool(subject.college, c.college)) &&
      (subject.position === null || samePositionGroup(subject.position, c.position)),
  );
  return rankCandidates(subject, corroborated)[0] ?? null;
}
