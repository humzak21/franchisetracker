/** Editing one number of a player's season by hand: which keys can be typed, and the new line. Pure. */
import { isRawStatKey, RAW_STATS } from "./registry";

/** Games played edits like a stat; it is kept beside the totals rather than in them. */
export const GAMES_EDIT_KEY = "gamesPlayed";
/** Comfortably past any season total Madden prints. */
const MAX_VALUE = 100_000;

export type StatEdit = { ok: true } | { ok: false; error: string };

/** Recorded stats and games played can be typed; rates and averages are worked out from them. */
export function checkStatEdit(key: string, value: number | null): StatEdit {
  if (key !== GAMES_EDIT_KEY && !isRawStatKey(key)) {
    return { ok: false, error: "Only recorded stats can be edited; rates are worked out from them" };
  }
  if (value === null) return { ok: true };
  if (!Number.isFinite(value) || Math.abs(value) > MAX_VALUE)
    return { ok: false, error: "That number is out of range" };
  const whole = key === GAMES_EDIT_KEY || RAW_STATS[key as keyof typeof RAW_STATS].format !== "half";
  if (whole && !Number.isInteger(value)) return { ok: false, error: "Use a whole number" };
  if (key === GAMES_EDIT_KEY && (value < 0 || value > 25))
    return { ok: false, error: "Games played is 0 to 25" };
  return { ok: true };
}

/** The line with one stat set, or removed when the value is cleared. */
export function withStat(line: Readonly<Record<string, number>>, key: string, value: number | null) {
  const next = { ...line };
  if (value === null) delete next[key];
  else next[key] = value;
  return next;
}
