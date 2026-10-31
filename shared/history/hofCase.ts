/**
 * A Hall of Fame case (FEATURES.md 5.7): what the owner weighs at induction, drawn from the record
 * lists, the awards and the marks. It argues; the wall stays the owner's call. Pure.
 */
import { AWARD_INFO, AWARD_TYPES, type AwardType } from "../domain/awards";
import { MARK_STATS, markLabel, type MarkStat } from "../stats/marks";
import { isStatKey, STAT_REGISTRY } from "../stats/registry";

/** Seasons a player waits after retiring. */
export const HOF_WAIT = 5;

export const hofEligible = (retiredYear: number, currentYear: number) =>
  currentYear - retiredYear >= HOF_WAIT;

/** Lines the case shows from each list. */
const SHOWN = 6;

const SCOPE_WORDS = { career: "career", season: "season", game: "game" } as const;
type Scope = keyof typeof SCOPE_WORDS;

type Placement = { book: string; split: string; scope: Scope; statKey: string; rank: number };
type Honor = { type: AwardType; weekKey?: string };
type Mark = { statKey: string; mark: number; horizon: string };

export type HofCase = {
  honors: { label: string; count: number }[];
  weekly: number;
  records: string[];
  firsts: number;
  lists: number;
  marks: string[];
};

const placementLine = (p: Placement) =>
  isStatKey(p.statKey)
    ? `#${p.rank} ${SCOPE_WORDS[p.scope]} ${STAT_REGISTRY[p.statKey].label.toLowerCase()}`
    : null;

/** Each stat's best standing in the team's regular-season book, career lists before the rest. */
function bestRecords(placements: readonly Placement[]) {
  const best = new Map<string, Placement>();
  for (const p of placements) {
    const key = `${p.scope}:${p.statKey}`;
    const seen = best.get(key);
    if (!seen || p.rank < seen.rank) best.set(key, p);
  }
  return [...best.values()]
    .sort((a, b) => a.rank - b.rank || Number(b.scope === "career") - Number(a.scope === "career"))
    .flatMap((p) => placementLine(p) ?? [])
    .slice(0, SHOWN);
}

/** The highest career mark in each stat: 10,000 rushing yards speaks for the 5,000 before it. */
function topMarks(marks: readonly Mark[]) {
  const best = new Map<MarkStat, number>();
  for (const { statKey, mark, horizon } of marks) {
    const stat = MARK_STATS.find((s) => s === statKey);
    if (stat && horizon === "career") best.set(stat, Math.max(best.get(stat) ?? 0, mark));
  }
  return [...best]
    .sort((a, b) => b[1] - a[1])
    .slice(0, SHOWN)
    .map(([statKey, mark]) => markLabel({ statKey, mark }));
}

export function hofCase(input: {
  placements: readonly Placement[];
  awards: readonly Honor[];
  marks: readonly Mark[];
}): HofCase {
  const team = input.placements.filter((p) => p.book === "team" && p.split === "regular");
  const counts = new Map<AwardType, number>();
  for (const a of input.awards) {
    if (a.weekKey === undefined && a.type !== "custom") counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  return {
    honors: [...counts]
      .sort((a, b) => AWARD_TYPES.indexOf(a[0]) - AWARD_TYPES.indexOf(b[0]))
      .map(([type, count]) => ({ label: AWARD_INFO[type].label, count })),
    weekly: input.awards.filter((a) => a.weekKey !== undefined).length,
    records: bestRecords(team),
    firsts: team.filter((p) => p.rank === 1).length,
    lists: team.length,
    marks: topMarks(input.marks),
  };
}
