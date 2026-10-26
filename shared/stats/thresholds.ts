/**
 * Elite highlight thresholds (season level, two tiers) and threshold games (game level).
 * Defaults come from FEATURES.md 5.5; franchises override season tiers in settings.
 */
import { statValue } from "./aggregate";
import { PERFECT_PASSER_RATING } from "./math";
import { STAT_REGISTRY, type StatKey, type StatLine } from "./registry";

export type Tier = 0 | 1 | 2;
export type TierThreshold = { tier1: number; tier2?: number };
export type ThresholdOverrides = Partial<Record<StatKey, TierThreshold>>;

export const DEFAULT_SEASON_THRESHOLDS: ThresholdOverrides = {
  passYds: { tier1: 5000, tier2: 5500 },
  passTd: { tier1: 40, tier2: 50 },
  passCmpPct: { tier1: 70, tier2: 75 },
  passRating: { tier1: 110, tier2: 120 },
  rushYds: { tier1: 1000, tier2: 1500 },
  rushTd: { tier1: 10, tier2: 15 },
  rec: { tier1: 100, tier2: 120 },
  recYds: { tier1: 1000, tier2: 1500 },
  recTd: { tier1: 10, tier2: 15 },
  tackles: { tier1: 100, tier2: 130 },
  sacks: { tier1: 10, tier2: 15 },
  defInt: { tier1: 5, tier2: 8 },
  fgPct: { tier1: 90, tier2: 95 },
};

/** Highlight tier for a value. Respects the stat's `better` direction. */
export function eliteTier(
  key: StatKey,
  value: number | null | undefined,
  overrides?: ThresholdOverrides,
): Tier {
  if (value === null || value === undefined) return 0;
  const threshold = overrides?.[key] ?? DEFAULT_SEASON_THRESHOLDS[key];
  if (!threshold) return 0;
  const meets = (limit: number) => (STAT_REGISTRY[key].better === "higher" ? value >= limit : value <= limit);
  if (threshold.tier2 !== undefined && meets(threshold.tier2)) return 2;
  return meets(threshold.tier1) ? 1 : 0;
}

export type GameThreshold = {
  key: string;
  stat: StatKey;
  min: number;
  label: string;
  short: string;
  /** Common enough to mark in a box score but not news: no milestone. */
  minor?: true;
};

/** Single-game performances that count toward "threshold games" and get highlighted in box scores. */
export const GAME_THRESHOLDS = [
  { key: "pass300", stat: "passYds", min: 300, label: "300-yard passing game", short: "300+" },
  { key: "pass3td", stat: "passTd", min: 3, label: "3+ passing touchdowns", short: "3+ TD" },
  {
    key: "perfectRating",
    stat: "passRating",
    min: PERFECT_PASSER_RATING,
    label: "Perfect passer rating",
    short: "158.3",
  },
  { key: "rush100", stat: "rushYds", min: 100, label: "100-yard rushing game", short: "100+" },
  { key: "rec100", stat: "recYds", min: 100, label: "100-yard receiving game", short: "100+" },
  { key: "rec5", stat: "rec", min: 5, label: "5+ catches", short: "5+ REC", minor: true },
  { key: "scrimmage3td", stat: "scrimmageTd", min: 3, label: "3+ touchdowns", short: "3 TD" },
  { key: "sacks2", stat: "sacks", min: 2, label: "2+ sacks", short: "2+ SK" },
  { key: "int2", stat: "defInt", min: 2, label: "2+ interceptions", short: "2+ INT" },
] as const satisfies readonly GameThreshold[];

export type GameThresholdKey = (typeof GAME_THRESHOLDS)[number]["key"];

/** Thresholds a single game line meets. */
export function gameHighlights(line: StatLine): GameThreshold[] {
  return GAME_THRESHOLDS.filter((t) => {
    const value = statValue(t.stat, line);
    return value !== null && value >= t.min;
  });
}
