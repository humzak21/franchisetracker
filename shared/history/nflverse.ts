/**
 * Real NFL history from nflverse (docs/NFL-HISTORY.md): which files, which seasons, and the
 * standings mapping. Pure; the Convex import action fetches and the mutations write.
 */
import type { PlayoffResult } from "../domain/calendar";
import { resolveTeamAbbr } from "../domain/teams";
import { mapCsv, num } from "./csv";
import { parseGames, winnerOf, type GameType, type PlayedGame } from "./nflverseGames";

/**
 * First season imported: nflverse publishes schedules and player season totals from 1999.
 * 1999–2001 had six divisions; standings and brackets read them through `shared/league/alignment`.
 */
export const NFLVERSE_FIRST_YEAR = 1999;

/**
 * First season in nfldata's standings file. Earlier seasons' standings are derived from the
 * schedule's results (`eraStandings.ts`).
 */
export const STANDINGS_FILE_FIRST_YEAR = 2002;

const RELEASES = "https://github.com/nflverse/nflverse-data/releases/download";

export const NFLVERSE_URLS = {
  standings: "https://raw.githubusercontent.com/nflverse/nfldata/master/data/standings.csv",
  games: `${RELEASES}/schedules/games.csv`,
  players: `${RELEASES}/players/players.csv`,
  draftPicks: `${RELEASES}/draft_picks/draft_picks.csv`,
  seasonStats: (year: number, split: "regular" | "postseason") =>
    `${RELEASES}/stats_player/stats_player_${split === "regular" ? "reg" : "post"}_${year}.csv`,
  roster: (year: number) => `${RELEASES}/rosters/roster_${year}.csv`,
} as const;

/** The round a loss in each playoff game type ends a season at. */
const EXIT_BY_ROUND: Partial<Record<GameType, PlayoffResult>> = {
  WC: "wc_loss",
  DIV: "div_loss",
  CON: "conf_loss",
  SB: "sb_loss",
};

/** Where each team's season ended, per year, for seasons whose Super Bowl has been played. */
export type PlayoffResults = Map<number, Map<string, PlayoffResult>>;

/**
 * Playoff exits from the schedule's playoff games. The standings file lags a season behind on
 * playoff results, so the games are the source of truth for them and for which seasons are over.
 */
export function playoffsFromGames(games: readonly PlayedGame[]): PlayoffResults {
  const byYear = new Map<number, Map<string, PlayoffResult>>();
  const finished = new Set<number>();
  for (const game of games) {
    const exit = EXIT_BY_ROUND[game.type];
    const winner = winnerOf(game);
    if (!exit || !winner) continue;
    const loser = winner === game.home ? game.away : game.home;
    const results = byYear.get(game.year) ?? new Map<string, PlayoffResult>();
    results.set(loser, exit);
    if (game.type === "SB") {
      results.set(winner, "champion");
      finished.add(game.year);
    }
    byYear.set(game.year, results);
  }
  for (const year of byYear.keys()) if (!finished.has(year)) byYear.delete(year);
  return byYear;
}

/** `playoffsFromGames` straight from `games.csv`. */
export function parsePlayoffs(text: string): PlayoffResults {
  return playoffsFromGames(parseGames(text));
}

export type ImportedStanding = {
  year: number;
  teamAbbr: string;
  w: number;
  l: number;
  t: number;
  divisionRank?: number;
  seed?: number;
  playoffResult: PlayoffResult;
  pointsFor?: number;
  pointsAgainst?: number;
};

const STANDING_COLUMNS = [
  "season",
  "team",
  "wins",
  "losses",
  "ties",
  "div_rank",
  "seed",
  "scored",
  "allowed",
] as const;

const optional = (value: string) => num(value) ?? undefined;

/** Standings for every team in each finished season, teams resolved to today's abbreviations. */
export function parseStandings(text: string, playoffs: PlayoffResults): ImportedStanding[] {
  return mapCsv(text, STANDING_COLUMNS, (row) => {
    const year = num(row.season);
    const teamAbbr = resolveTeamAbbr(row.team);
    const results = year === null ? undefined : playoffs.get(year);
    if (year === null || !teamAbbr || !results) return null;
    return {
      year,
      teamAbbr,
      w: num(row.wins) ?? 0,
      l: num(row.losses) ?? 0,
      t: num(row.ties) ?? 0,
      divisionRank: optional(row.div_rank),
      seed: optional(row.seed),
      playoffResult: results.get(teamAbbr) ?? "missed",
      pointsFor: optional(row.scored),
      pointsAgainst: optional(row.allowed),
    };
  });
}

/** Finished seasons from the first covered year up to (not including) the franchise's first. */
export function importYears(startYear: number, playoffs: PlayoffResults): number[] {
  const years: number[] = [];
  for (let year = NFLVERSE_FIRST_YEAR; year < startYear; year++) if (playoffs.has(year)) years.push(year);
  return years;
}

/** Seasons before the franchise's first are real NFL history, never captured play. */
export function isPreFranchise(year: number, startYear: number): boolean {
  return year < startYear;
}
