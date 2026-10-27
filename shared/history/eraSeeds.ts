/**
 * Playoff seeds of the twelve-team format (six per conference, two byes) worked out from who
 * actually played whom in the playoffs, so no NFL tiebreaker has to be reimplemented. Pure.
 */
import { CONFERENCES, type Conference } from "../domain/teams";
import type { Alignment } from "../league/alignment";
import { winnerOf, type PlayedGame } from "./nflverseGames";

/** Orders teams best first by record; settles the rare case the games alone cannot. */
export type RankTeams = (teams: readonly string[]) => string[];

/**
 * One conference's seeds, or none when its games do not have the twelve-team shape:
 * - the two teams that first play in the divisional round had byes, so they are seeds 1 and 2;
 * - wild card hosts are seed 3 (the third division winner: the division without a bye team) and
 *   seed 4 (the best wild card); seed 3 hosts 6 and seed 4 hosts 5;
 * - seed 1 hosts the lowest seed left after the wild card round.
 */
function conferenceSeeds(
  conference: Conference,
  games: readonly PlayedGame[],
  alignment: ReadonlyMap<string, Alignment>,
  rank: RankTeams,
): [string, number][] {
  const inConference = (g: PlayedGame) => alignment.get(g.home)?.conference === conference;
  const [wcA, wcB, ...moreWildCard] = games.filter((g) => g.type === "WC" && inConference(g));
  const divisional = games.filter((g) => g.type === "DIV" && inConference(g));
  if (!wcA || !wcB || moreWildCard.length > 0 || divisional.length !== 2) return [];
  const played = new Set([wcA.home, wcA.away, wcB.home, wcB.away]);
  const [byeA, byeB, ...moreByes] = divisional.flatMap((g) => [g.home, g.away]).filter((t) => !played.has(t));
  if (!byeA || !byeB || moreByes.length > 0) return [];

  // Seed 3 won the division without a bye team; when both hosts are from it, the better record won.
  const byeDivisions = new Set([byeA, byeB].map((t) => alignment.get(t)?.division));
  const third = (g: PlayedGame) => !byeDivisions.has(alignment.get(g.home)?.division);
  const aIsThird = third(wcA) !== third(wcB) ? third(wcA) : rank([wcA.home, wcB.home])[0] === wcA.home;
  const [three, four] = aIsThird ? [wcA, wcB] : [wcB, wcA];
  const seeds = new Map<string, number>([
    [three.home, 3],
    [four.home, 4],
    [four.away, 5],
    [three.away, 6],
  ]);

  const survivors = [winnerOf(wcA), winnerOf(wcB)].filter((t): t is string => t !== null);
  const lowest = [...survivors].sort((a, b) => (seeds.get(b) ?? 0) - (seeds.get(a) ?? 0))[0];
  const hostedLowest = divisional.find((g) => g.away === lowest)?.home;
  const top = hostedLowest === byeA || hostedLowest === byeB ? hostedLowest : rank([byeA, byeB])[0];
  seeds.set(top === byeB ? byeB : byeA, 1);
  seeds.set(top === byeB ? byeA : byeB, 2);
  return [...seeds];
}

/** Seeds 1–6 in each conference for one season (games of other seasons are ignored). */
export function seedsFromPlayoffs(
  year: number,
  games: readonly PlayedGame[],
  alignment: ReadonlyMap<string, Alignment>,
  rank: RankTeams,
): Map<string, number> {
  const season = games.filter((g) => g.year === year && g.type !== "REG");
  return new Map(CONFERENCES.flatMap((c) => conferenceSeeds(c, season, alignment, rank)));
}
