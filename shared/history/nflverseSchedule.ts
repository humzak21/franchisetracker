/**
 * One season's regular-season schedule from nflverse `games.csv`: who plays whom each week and
 * when. Madden's first franchise season plays the real schedule, so it can be loaded before
 * kickoff. Real scores are never read: the franchise's games are the ones played in Madden. Pure.
 */
import { isWeekKey, type WeekKey } from "../domain/calendar";
import { resolveTeamAbbr } from "../domain/teams";
import { num, readCsv } from "./csv";

export type ScheduledGame = { weekKey: WeekKey; away: string; home: string; timeLabel?: string };

const COLUMNS = ["season", "game_type", "week", "weekday", "gametime", "away_team", "home_team"] as const;

/** "Thursday", "20:15" → "Thu 8:15 PM", as Madden's schedule screen prints it. */
export function kickoffLabel(weekday: string, gametime: string): string | undefined {
  const [h, m] = gametime.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return undefined;
  const hour = h % 12 === 0 ? 12 : h % 12;
  const time = `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return weekday ? `${weekday.slice(0, 3)} ${time}` : time;
}

export function parseSchedule(text: string, year: number): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  for (const row of readCsv(text, COLUMNS)) {
    if (num(row.season) !== year || row.game_type !== "REG") continue;
    const weekKey = `w${num(row.week) ?? 0}`;
    const away = resolveTeamAbbr(row.away_team);
    const home = resolveTeamAbbr(row.home_team);
    if (!isWeekKey(weekKey) || !away || !home) continue;
    const timeLabel = kickoffLabel(row.weekday, row.gametime);
    games.push({ weekKey, away, home, ...(timeLabel ? { timeLabel } : {}) });
  }
  return games;
}
