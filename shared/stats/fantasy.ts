/**
 * Fantasy points with ESPN's default PPR scoring. Pure.
 *
 * Offense: 0.04 per passing yard, 4 per passing TD, -2 per interception thrown, 0.1 per rushing
 * or receiving yard, 6 per rushing or receiving TD, 1 per reception, -2 per fumble lost, 6 per
 * kick or punt return TD. Kicking: 3 for a field goal under 40 yards, 4 from 40-49, 5 from 50+,
 * -1 per missed field goal, 1 per extra point, -1 per missed extra point. ESPN's default league
 * has no individual defensive scoring, so a defender scores only on returns.
 */
import type { RawStatKey, StatLine } from "./registry";

/** Points per unit of each raw stat. Missed kicks are scored from made and attempted below. */
export const PPR_POINTS: Partial<Record<RawStatKey, number>> = {
  passYds: 0.04,
  passTd: 4,
  passInt: -2,
  rushYds: 0.1,
  rushTd: 6,
  rec: 1,
  recYds: 0.1,
  recTd: 6,
  // Madden's box score counts fumbles, not fumbles lost; the two match for almost every carry.
  fumbles: -2,
  kickReturnTd: 6,
  puntReturnTd: 6,
  fgm0_29: 3,
  fgm30_39: 3,
  fgm40_49: 4,
  fgm50plus: 5,
  xpm: 1,
};

const FG_BUCKETS = ["fgm0_29", "fgm30_39", "fgm40_49", "fgm50plus"] as const;
/** A made field goal whose distance was not recorded scores as a short one. */
const UNKNOWN_DISTANCE_FG = 3;
const MISSED_KICK = -1;

const n = (line: StatLine, key: RawStatKey) => line[key] ?? 0;

/** A line's fantasy points, rounded to hundredths; null for a line with nothing recorded. */
export function fantasyPoints(line: StatLine): number | null {
  if (Object.values(line).every((value) => value === undefined)) return null;
  let points = 0;
  for (const [key, per] of Object.entries(PPR_POINTS) as [RawStatKey, number][]) {
    points += n(line, key) * per;
  }
  const bucketed = FG_BUCKETS.reduce((sum, key) => sum + n(line, key), 0);
  points += Math.max(0, n(line, "fgm") - bucketed) * UNKNOWN_DISTANCE_FG;
  points += Math.max(0, n(line, "fga") - n(line, "fgm")) * MISSED_KICK;
  points += Math.max(0, n(line, "xpa") - n(line, "xpm")) * MISSED_KICK;
  return Math.round(points * 100) / 100;
}
