/** Telling a bye week from a partly captured one on the league schedule (FEATURES.md 5.11). Pure. */
import { weekPhase, type WeekKey } from "../domain/calendar";

/** Byes leave at most six of the 32 teams idle, so a bye week has 13 to 15 games. */
const BYE_WEEK_GAMES = { min: 13, max: 15 } as const;

/**
 * Whether a team missing from a week's games is on its bye: only in the regular season, and only
 * when the week holds as many games as a bye week does. A full 16-game week has no byes, and a
 * week with fewer than 13 games read is too partial to say.
 */
export function isByeWeekSlate(weekKey: WeekKey, games: number): boolean {
  return weekPhase(weekKey) === "regular" && games >= BYE_WEEK_GAMES.min && games <= BYE_WEEK_GAMES.max;
}
