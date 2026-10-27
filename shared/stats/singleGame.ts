/**
 * Single-game values: what one box score line says about a stat. Rates need volume to mean
 * anything, so a 1-for-1 game is neither a perfect passer rating nor the season's best
 * completion percentage.
 */
import { statValue } from "./aggregate";
import {
  STAT_KEYS,
  STAT_REGISTRY,
  isRawStatKey,
  type DerivedStatKey,
  type RawStatKey,
  type StatKey,
  type StatLine,
} from "./registry";

export type GameMinimum = { stat: RawStatKey; min: number };

/**
 * The volume a game needs before a rate stat counts. Ten attempts is the usual bar for a
 * perfect passer rating; the rest sit at a few touches so a backup's cameo never sets a high.
 */
export const SINGLE_GAME_MINIMUMS: Partial<Record<DerivedStatKey, GameMinimum>> = {
  passCmpPct: { stat: "passAtt", min: 10 },
  passYpa: { stat: "passAtt", min: 10 },
  passRating: { stat: "passAtt", min: 10 },
  rushAvg: { stat: "rushAtt", min: 5 },
  recAvg: { stat: "rec", min: 3 },
  fgPct: { stat: "fga", min: 3 },
  xpPct: { stat: "xpa", min: 3 },
  puntAvg: { stat: "punts", min: 3 },
  kickReturnAvg: { stat: "kickReturns", min: 2 },
  puntReturnAvg: { stat: "puntReturns", min: 2 },
};

/** A stat's value for one game, or null when it was not recorded or the game lacks the volume. */
export function singleGameValue(stat: StatKey, line: StatLine): number | null {
  if (!isRawStatKey(stat)) {
    const minimum = SINGLE_GAME_MINIMUMS[stat];
    if (minimum && (line[minimum.stat] ?? 0) < minimum.min) return null;
  }
  return statValue(stat, line);
}

/**
 * Stats with a meaningful best game: summed raw stats where more is better (not longest-play
 * stats, whose season total already is the best game, nor interceptions thrown), and derived
 * stats other than per-game rates, which inside one game only repeat the total.
 */
export const SEASON_HIGH_STATS: readonly StatKey[] = STAT_KEYS.filter((key) => {
  const def = STAT_REGISTRY[key];
  if (def.better !== "higher") return false;
  return def.kind === "raw" ? def.aggregation === "sum" : !def.perGame;
});
