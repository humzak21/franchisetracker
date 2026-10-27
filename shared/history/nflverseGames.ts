/**
 * nflverse schedules (`games.csv`) → played games with teams resolved to today's abbreviations
 * (OAK → LV, SD → LAC, STL → LAR). The playoff results of every season and the derived standings
 * of seasons before nfldata's standings file (1999–2001) both read from here. Pure.
 */
import { resolveTeamAbbr } from "../domain/teams";
import { num, readCsv } from "./csv";

export const GAME_TYPES = ["REG", "WC", "DIV", "CON", "SB"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export type PlayedGame = {
  year: number;
  type: GameType;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
};

const GAME_COLUMNS = ["season", "game_type", "away_team", "away_score", "home_team", "home_score"] as const;

const isGameType = (value: string): value is GameType => (GAME_TYPES as readonly string[]).includes(value);

/** Every game with a final score; unplayed games and unknown teams are skipped. */
export function parseGames(text: string): PlayedGame[] {
  const games: PlayedGame[] = [];
  for (const row of readCsv(text, GAME_COLUMNS)) {
    const year = num(row.season);
    const away = resolveTeamAbbr(row.away_team);
    const home = resolveTeamAbbr(row.home_team);
    const awayScore = num(row.away_score);
    const homeScore = num(row.home_score);
    if (!isGameType(row.game_type) || year === null || !away || !home) continue;
    if (awayScore === null || homeScore === null) continue;
    games.push({ year, type: row.game_type, away, home, awayScore, homeScore });
  }
  return games;
}

/** The winner of a game, or null for a tie. */
export function winnerOf(game: PlayedGame): string | null {
  if (game.awayScore === game.homeScore) return null;
  return game.awayScore > game.homeScore ? game.away : game.home;
}
