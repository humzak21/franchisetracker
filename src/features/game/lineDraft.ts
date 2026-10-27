/** A box score line typed by hand: one category's recorded stats as text inputs, parsed for `addLine`. */
import { validGameStat } from "@shared/games/statEdit";
import { RAW_STAT_KEYS, STAT_REGISTRY, type RawStatKey, type StatCategory } from "@shared/stats";

export function rawStatsIn(category: StatCategory): RawStatKey[] {
  return RAW_STAT_KEYS.filter((key) => STAT_REGISTRY[key].category === category);
}

export type ParsedLine = { ok: true; stats: Record<string, number> } | { ok: false; error: string };

/** Blank inputs are left out; anything else must be a valid game number. At least one is needed. */
export function parseLine(inputs: Readonly<Record<string, string>>): ParsedLine {
  const stats: Record<string, number> = {};
  for (const [key, text] of Object.entries(inputs)) {
    if (text.trim() === "") continue;
    const value = Number(text.trim());
    if (!validGameStat(value)) {
      const label = key in STAT_REGISTRY ? STAT_REGISTRY[key as RawStatKey].label : key;
      return { ok: false, error: `${label}: not a valid number` };
    }
    stats[key] = value;
  }
  if (Object.keys(stats).length === 0) return { ok: false, error: "Enter at least one stat" };
  return { ok: true, stats };
}
