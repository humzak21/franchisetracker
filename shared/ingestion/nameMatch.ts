/**
 * Resolves a printed player name ("D. Maye", "Maye", "Stefon Digs") against known players.
 * Pure scoring; Convex supplies the candidates (the season's rosters, then the franchise).
 */
import type { MatchCandidate, PlayerMatch } from "./types";

export type NameCandidate<P extends string = string> = {
  playerId: P;
  displayName: string;
  firstName: string;
  lastName: string;
  aliases: readonly string[];
  teamAbbr?: string | null;
  position?: string | null;
};

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Lowercase words without punctuation or generational suffixes: "D.J. Moore Jr." → ["dj", "moore"]. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\w)\.(?=\w\.)/g, "$1")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/['-]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !SUFFIXES.has(t));
}

/** Jaro-Winkler similarity in [0, 1]; tolerant of the one-letter misreads OCR makes. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** How well a printed name fits one known name, in [0, 1]. */
export function nameScore(printed: string, known: { first: string; last: string; full: string }): number {
  const p = nameTokens(printed);
  const last = nameTokens(known.last).join("");
  const first = nameTokens(known.first).join("");
  const full = nameTokens(known.full).join(" ");
  if (p.length === 0) return 0;
  if (p.join(" ") === full) return 1;
  const pLast = p[p.length - 1] ?? "";
  const pFirst = p.length > 1 ? p.slice(0, -1).join("") : "";
  const lastSim = similarity(pLast, last);
  if (pFirst === "") return lastSim * 0.85;
  // "D Maye" or "DJ Moore": initials against the first name.
  const firstSim = pFirst.length <= 2 ? (first.startsWith(pFirst) ? 1 : 0.4) : similarity(pFirst, first);
  return Math.min(1, lastSim * 0.65 + firstSim * 0.35) * (pFirst.length <= 2 ? 0.95 : 1);
}

const MATCH_SCORE = 0.9;
const AMBIGUOUS_SCORE = 0.72;
const CANDIDATE_FLOOR = 0.6;
/** A runner-up this close to the best makes the match ambiguous. */
const CLEAR_MARGIN = 0.06;

/** Scores every candidate, preferring the line's team and position, and decides the match status. */
export function matchPlayer<P extends string>(
  printed: string,
  candidates: readonly NameCandidate<P>[],
  hint: { teamAbbr?: string | null; position?: string | null } = {},
): PlayerMatch<P> {
  const scored: MatchCandidate<P>[] = [];
  for (const c of candidates) {
    const names = [
      { first: c.firstName, last: c.lastName, full: c.displayName },
      ...c.aliases.map((alias) => {
        const tokens = alias.trim().split(/\s+/);
        return { first: tokens.slice(0, -1).join(" "), last: tokens[tokens.length - 1] ?? "", full: alias };
      }),
    ];
    let score = Math.max(...names.map((n) => nameScore(printed, n)));
    if (hint.teamAbbr && c.teamAbbr === hint.teamAbbr) score += 0.04;
    if (hint.position && c.position === hint.position) score += 0.02;
    if (score >= CANDIDATE_FLOOR)
      scored.push({ playerId: c.playerId, name: c.displayName, score: Math.min(1, score) });
  }
  scored.sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  const top = scored.slice(0, 5);
  if (!best || best.score < AMBIGUOUS_SCORE) return { status: "new", candidates: top };
  const clear = !second || best.score - second.score >= CLEAR_MARGIN;
  return { status: best.score >= MATCH_SCORE && clear ? "matched" : "ambiguous", candidates: top };
}
