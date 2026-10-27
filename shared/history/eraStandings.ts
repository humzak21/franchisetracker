/**
 * Standings of seasons before nfldata's standings file (1999–2001), derived from the schedule:
 * records and points from the regular season, seeds from the playoff games (`eraSeeds.ts`) and
 * division order from the era's alignment. Pure.
 */
import type { PlayoffResult } from "../domain/calendar";
import { leagueAlignment, type Alignment } from "../league/alignment";
import { winPct } from "../stats/format";
import { seedsFromPlayoffs } from "./eraSeeds";
import type { ImportedStanding } from "./nflverse";
import { winnerOf, type PlayedGame } from "./nflverseGames";

type Record3 = { w: number; l: number; t: number };
type TeamRecord = Record3 & { pointsFor: number; pointsAgainst: number; division: Record3 };

const blank = (): Record3 => ({ w: 0, l: 0, t: 0 });
const pct = (r: Record3) => winPct(r) ?? 0;

function tally(record: Record3, team: string, game: PlayedGame) {
  const winner = winnerOf(game);
  if (winner === null) record.t++;
  else if (winner === team) record.w++;
  else record.l++;
}

/** Regular-season records, points and division records. */
function records(games: readonly PlayedGame[], alignment: ReadonlyMap<string, Alignment>) {
  const byTeam = new Map<string, TeamRecord>();
  for (const game of games) {
    const sameDivision =
      alignment.get(game.home)?.conference === alignment.get(game.away)?.conference &&
      alignment.get(game.home)?.division === alignment.get(game.away)?.division;
    for (const [team, scored, allowed] of [
      [game.home, game.homeScore, game.awayScore],
      [game.away, game.awayScore, game.homeScore],
    ] as const) {
      const record = byTeam.get(team) ?? { ...blank(), pointsFor: 0, pointsAgainst: 0, division: blank() };
      tally(record, team, game);
      if (sameDivision) tally(record.division, team, game);
      record.pointsFor += scored;
      record.pointsAgainst += allowed;
      byTeam.set(team, record);
    }
  }
  return byTeam;
}

/**
 * Orders teams best first: win percentage, then within a tie the record in games between the
 * tied teams, division record, point differential and finally the abbreviation. A documented
 * stand-in for the NFL's tiebreakers (which also weigh common games and strength of victory).
 */
function ranker(games: readonly PlayedGame[], byTeam: ReadonlyMap<string, TeamRecord>) {
  const record = (team: string) =>
    byTeam.get(team) ?? { ...blank(), pointsFor: 0, pointsAgainst: 0, division: blank() };
  return (teams: readonly string[]): string[] => {
    const headToHead = (team: string, tied: readonly string[]) => {
      const among = blank();
      for (const g of games) {
        const opponent = g.home === team ? g.away : g.away === team ? g.home : null;
        if (opponent !== null && opponent !== team && tied.includes(opponent)) tally(among, team, g);
      }
      return pct(among);
    };
    return [...teams].sort((a, b) => {
      const byPct = pct(record(b)) - pct(record(a));
      if (byPct !== 0) return byPct;
      const tied = teams.filter((t) => pct(record(t)) === pct(record(a)));
      const diff = (t: string) => record(t).pointsFor - record(t).pointsAgainst;
      return (
        headToHead(b, tied) - headToHead(a, tied) ||
        pct(record(b).division) - pct(record(a).division) ||
        diff(b) - diff(a) ||
        a.localeCompare(b)
      );
    });
  };
}

/**
 * Every team's standing in one season from the schedule. The division winner is the division's
 * team seeded 1–3 (division winners take the top three seeds); the rest follow by record, a
 * playoff team ahead of a non-playoff team on the same record (it won that tiebreaker).
 */
export function deriveStandings(
  year: number,
  games: readonly PlayedGame[],
  results: ReadonlyMap<string, PlayoffResult> | undefined,
): ImportedStanding[] {
  const alignment = leagueAlignment(year);
  const regular = games.filter((g) => g.year === year && g.type === "REG");
  const byTeam = records(regular, alignment);
  const rank = ranker(regular, byTeam);
  const seeds = seedsFromPlayoffs(year, games, alignment, rank);

  const divisions = new Map<string, string[]>();
  for (const team of byTeam.keys()) {
    const at = alignment.get(team);
    if (!at) continue;
    const key = `${at.conference} ${at.division}`;
    divisions.set(key, [...(divisions.get(key) ?? []), team]);
  }
  const divisionRank = new Map<string, number>();
  for (const teams of divisions.values()) {
    const winner = teams.find((t) => (seeds.get(t) ?? 9) <= 3);
    const ranked = rank(teams).sort(
      (a, b) =>
        Number(b === winner) - Number(a === winner) ||
        pct(byTeam.get(b) ?? blank()) - pct(byTeam.get(a) ?? blank()) ||
        Number(seeds.has(b)) - Number(seeds.has(a)),
    );
    ranked.forEach((team, i) => divisionRank.set(team, i + 1));
  }

  return [...byTeam].flatMap(([teamAbbr, r]) =>
    alignment.has(teamAbbr)
      ? [
          {
            year,
            teamAbbr,
            w: r.w,
            l: r.l,
            t: r.t,
            divisionRank: divisionRank.get(teamAbbr),
            seed: seeds.get(teamAbbr),
            playoffResult: results?.get(teamAbbr) ?? "missed",
            pointsFor: r.pointsFor,
            pointsAgainst: r.pointsAgainst,
          },
        ]
      : [],
  );
}
