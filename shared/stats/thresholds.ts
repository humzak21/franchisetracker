/**
 * Elite highlight thresholds (season level, two tiers) and threshold games (game level).
 * Defaults come from FEATURES.md 5.5; franchises override season tiers in settings.
 */
import { PERFECT_PASSER_RATING } from "./math";
import { STAT_REGISTRY, type StatKey, type StatLine } from "./registry";
import { singleGameValue } from "./singleGame";

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
  /** Box score badge. */
  short: string;
  /** Header of the season table's count column. */
  header: string;
  /** Common enough to mark in a box score but not news: no milestone. */
  minor?: true;
};

/**
 * Single-game performances that count toward "threshold games" and get highlighted in box
 * scores. Rate stats only count with enough volume (`SINGLE_GAME_MINIMUMS`).
 */
export const GAME_THRESHOLDS = [
  {
    key: "pass300",
    stat: "passYds",
    min: 300,
    label: "300-yard passing game",
    short: "300+",
    header: "300+",
  },
  { key: "pass3td", stat: "passTd", min: 3, label: "3+ passing touchdowns", short: "3+ TD", header: "3+ TD" },
  {
    key: "perfectRating",
    stat: "passRating",
    min: PERFECT_PASSER_RATING,
    label: "Perfect passer rating",
    short: "158.3",
    header: "158.3s",
  },
  {
    key: "rush100",
    stat: "rushYds",
    min: 100,
    label: "100-yard rushing game",
    short: "100+",
    header: "100+ RUSH",
  },
  {
    key: "rec100",
    stat: "recYds",
    min: 100,
    label: "100-yard receiving game",
    short: "100+",
    header: "100+ REC",
  },
  { key: "rec5", stat: "rec", min: 5, label: "5+ catches", short: "5+ REC", header: "5+ REC", minor: true },
  {
    key: "scrimmage2td",
    stat: "scrimmageTd",
    min: 2,
    label: "2+ touchdowns",
    short: "2+ TD",
    header: "2+ TD",
    minor: true,
  },
  {
    key: "scrimmage3td",
    stat: "scrimmageTd",
    min: 3,
    label: "3+ touchdowns",
    short: "3 TD",
    header: "3+ TD",
  },
  { key: "sacks2", stat: "sacks", min: 2, label: "2+ sacks", short: "2+ SK", header: "2+ SK" },
  { key: "int2", stat: "defInt", min: 2, label: "2+ interceptions", short: "2+ INT", header: "2+ INT" },
] as const satisfies readonly GameThreshold[];

export type GameThresholdKey = (typeof GAME_THRESHOLDS)[number]["key"];

export function gameThreshold(key: GameThresholdKey): GameThreshold {
  return GAME_THRESHOLDS.find((t) => t.key === key) ?? GAME_THRESHOLDS[0];
}

/** Every threshold a game line meets, inclusively: a 3-TD game is also a 2+ TD game. Season counts use this. */
export function gameThresholdsMet(line: StatLine): GameThreshold[] {
  return GAME_THRESHOLDS.filter((t) => {
    const value = singleGameValue(t.stat, line);
    return value !== null && value >= t.min;
  });
}

/** Thresholds to mark on a game line: the highest met per stat, so a 3-TD game reads "3 TD", not both. */
export function gameHighlights(line: StatLine): GameThreshold[] {
  const met = gameThresholdsMet(line);
  return met.filter((t) => !met.some((other) => other.stat === t.stat && other.min > t.min));
}
