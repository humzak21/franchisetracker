/**
 * Milestone detection for one player's game (FEATURES.md 5.1 and 5.5): threshold games, career
 * highs and first threshold seasons. Franchise records and streaks are detected where those
 * are computed. Each milestone carries a stable `key` so recommitting a game never duplicates it.
 */
import { aggregateLines, statValue } from "./aggregate";
import { formatStat } from "./format";
import { RAW_STATS, isRawStatKey, type RawStatKey, type StatLine } from "./registry";
import { DEFAULT_SEASON_THRESHOLDS, gameHighlights, type ThresholdOverrides } from "./thresholds";

export type MilestoneKind = "career_high" | "threshold_game" | "first_threshold_season";

export type DetectedMilestone = {
  key: string;
  kind: MilestoneKind;
  statKey: string;
  value: number;
  title: string;
};

/** Stats where a new single-game best is news. */
export const CAREER_HIGH_STATS: readonly RawStatKey[] = [
  "passYds",
  "passTd",
  "rushYds",
  "rushTd",
  "rec",
  "recYds",
  "recTd",
  "tackles",
  "sacks",
  "defInt",
];

/** A first game is everyone's career high; only count highs once there is something to beat. */
export const CAREER_HIGH_MIN_GAMES = 3;

export type PlayerGame = {
  name: string;
  line: StatLine;
  /** Every earlier game of the player's career, any team. */
  priorGames: readonly StatLine[];
  /** The player's totals for this season before this game. */
  seasonBefore: StatLine;
  /** Totals of each earlier season. */
  priorSeasons: readonly StatLine[];
  thresholds?: ThresholdOverrides;
};

const label = (key: RawStatKey) => RAW_STATS[key].label.toLowerCase();

export function detectMilestones(game: PlayerGame): DetectedMilestone[] {
  const out: DetectedMilestone[] = [];
  for (const t of gameHighlights(game.line)) {
    const value = statValue(t.stat, game.line) ?? t.min;
    out.push({
      key: `game:${t.key}`,
      kind: "threshold_game",
      statKey: t.stat,
      value,
      title: `${game.name}: ${t.label}`,
    });
  }

  if (game.priorGames.length >= CAREER_HIGH_MIN_GAMES) {
    for (const stat of CAREER_HIGH_STATS) {
      const value = game.line[stat] ?? 0;
      const best = Math.max(0, ...game.priorGames.map((g) => g[stat] ?? 0));
      if (value > 0 && value > best) {
        out.push({
          key: `high:${stat}`,
          kind: "career_high",
          statKey: stat,
          value,
          title: `${game.name}: career-high ${formatStat(stat, value)} ${label(stat)}`,
        });
      }
    }
  }

  const after = aggregateLines([game.seasonBefore, game.line]);
  const thresholds = { ...DEFAULT_SEASON_THRESHOLDS, ...game.thresholds };
  for (const [stat, threshold] of Object.entries(thresholds)) {
    if (!threshold || !isRawStatKey(stat) || RAW_STATS[stat].better !== "higher") continue;
    const target = threshold.tier1;
    const crossed = (game.seasonBefore[stat] ?? 0) < target && (after[stat] ?? 0) >= target;
    const before = game.priorSeasons.some((s) => (s[stat] ?? 0) >= target);
    if (crossed && !before) {
      out.push({
        key: `season:${stat}:${target}`,
        kind: "first_threshold_season",
        statKey: stat,
        value: after[stat] ?? 0,
        title: `${game.name}: first season with ${formatStat(stat, target)} ${label(stat)}`,
      });
    }
  }
  return out;
}
