/**
 * Team records worked out from scores: every league game captured from the schedule screen plus
 * the user team's own games. Only the regular season counts toward a record, as on Madden's
 * standings screen.
 */
import { weekPhase, type WeekKey } from "../domain/calendar";

export type ScoredGame = {
  weekKey: WeekKey;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
};

export type TeamRecord = { w: number; l: number; t: number; pointsFor: number; pointsAgainst: number };

export const gamesIn = (r: Pick<TeamRecord, "w" | "l" | "t">) => r.w + r.l + r.t;

/** One game per week and pair of teams: the same game captured twice (schedule screen and box score) counts once. */
const gameKey = (g: ScoredGame) => `${g.weekKey}|${[g.homeTeamId, g.awayTeamId].sort().join("|")}`;

/**
 * Records per team from the games that have a final score. Where the same game comes from two
 * sources, the later one in `games` wins, so callers list the more trusted source last.
 */
export function recordsFromGames(games: readonly ScoredGame[]): Map<string, TeamRecord> {
  const unique = new Map<string, ScoredGame>();
  for (const g of games) unique.set(gameKey(g), g);
  const records = new Map<string, TeamRecord>();
  const add = (teamId: string, scored: number, allowed: number) => {
    const r = records.get(teamId) ?? { w: 0, l: 0, t: 0, pointsFor: 0, pointsAgainst: 0 };
    if (scored > allowed) r.w++;
    else if (scored < allowed) r.l++;
    else r.t++;
    r.pointsFor += scored;
    r.pointsAgainst += allowed;
    records.set(teamId, r);
  };
  for (const g of unique.values()) {
    if (weekPhase(g.weekKey) !== "regular") continue;
    if (typeof g.homeScore !== "number" || typeof g.awayScore !== "number") continue;
    add(g.homeTeamId, g.homeScore, g.awayScore);
    add(g.awayTeamId, g.awayScore, g.homeScore);
  }
  return records;
}

/**
 * Whether a record worked out from scores should replace the one on file: always for a record
 * that was itself worked out (or none), otherwise only when the scores cover at least as many
 * games, so a later standings screen is never rolled back by an older week of scores.
 */
export function shouldReplaceRecord(
  stored: (Pick<TeamRecord, "w" | "l" | "t"> & { derived: boolean }) | null,
  derived: Pick<TeamRecord, "w" | "l" | "t">,
): boolean {
  if (!stored || stored.derived) return true;
  return gamesIn(derived) >= gamesIn(stored);
}
