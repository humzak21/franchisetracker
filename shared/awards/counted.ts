/**
 * Awards counted from the season's numbers rather than read off Madden's awards screen: the
 * league leader in fantasy points, sacks, interceptions and tackles, and the most players of
 * the week. A winner stored for the season overrides the count. Pure.
 */
import type { AwardType } from "../domain/awards";
import { formatStat } from "../stats/format";
import { aggregateLines, statValue } from "../stats/aggregate";
import type { StatKey, StatLine } from "../stats/registry";

type CountedDef = { unit: string } & ({ stat: StatKey } | { weekly: "OPOW" | "DPOW" });

export const COUNTED_AWARD_DEFS = {
  FPOY: { stat: "fantasyPts", unit: "fantasy pts" },
  SackLeader: { stat: "sacks", unit: "sacks" },
  BallHawk: { stat: "defInt", unit: "INT" },
  HeatSeeker: { stat: "tackles", unit: "tackles" },
  MostOPOW: { weekly: "OPOW", unit: "Offensive Player of the Week" },
  MostDPOW: { weekly: "DPOW", unit: "Defensive Player of the Week" },
} as const satisfies Partial<Record<AwardType, CountedDef>>;

export type CountedAward = keyof typeof COUNTED_AWARD_DEFS;
export const COUNTED_AWARDS = Object.keys(COUNTED_AWARD_DEFS) as CountedAward[];

export function isCountedAward(type: AwardType): type is CountedAward {
  return type in COUNTED_AWARD_DEFS;
}

/** One player's season across the league: their team's totals as captured or logged. */
export type LeagueLine<P, T = string> = { playerId: P; teamId: T; line: StatLine; games: number };
/** A weekly award won; the winner may be known only by name. */
export type WeeklyWin<P, T = string> = {
  type: AwardType;
  playerId: P | null;
  name: string;
  teamId: T | null;
};

export type Contender<P, T = string> = {
  playerId: P | null;
  name: string | null;
  teamId: T | null;
  value: number;
  statLine: string;
};

/** How many contenders each award lists, so an override can pick the runner-up. */
export const CONTENDERS = 5;

function statLine(type: CountedAward, value: number): string {
  const def: CountedDef = COUNTED_AWARD_DEFS[type];
  if ("stat" in def) return `${formatStat(def.stat, value)} ${def.unit}`;
  return `${value}× ${def.unit}`;
}

/** Best first, then the top `CONTENDERS` and anyone tied with the last of them. Zeros never count. */
function top<P, T>(type: CountedAward, entries: Omit<Contender<P, T>, "statLine">[]): Contender<P, T>[] {
  const sorted = entries.filter((e) => e.value > 0).sort((a, b) => b.value - a.value);
  const cutoff = sorted[CONTENDERS - 1]?.value ?? 0;
  return sorted
    .filter((e, i) => i < CONTENDERS || e.value === cutoff)
    .map((e) => ({ ...e, statLine: statLine(type, e.value) }));
}

/**
 * The contenders for each counted award, best first. A player who played for two teams has a
 * line for each; their totals are summed under the team they finished with (the last line).
 */
export function countedContenders<P extends string, T extends string>(
  lines: readonly LeagueLine<P, T>[],
  wins: readonly WeeklyWin<P, T>[],
): Record<CountedAward, Contender<P, T>[]> {
  const byPlayer = new Map<P, { teamId: T; lines: StatLine[]; games: number }>();
  for (const l of lines) {
    const entry = byPlayer.get(l.playerId) ?? { teamId: l.teamId, lines: [], games: 0 };
    entry.teamId = l.teamId;
    entry.lines.push(l.line);
    entry.games += l.games;
    byPlayer.set(l.playerId, entry);
  }
  const winsBy = (weekly: "OPOW" | "DPOW") => {
    const counts = new Map<string, Omit<Contender<P, T>, "statLine">>();
    for (const w of wins) {
      if (w.type !== weekly) continue;
      const key = w.playerId ?? `name:${w.name.toLowerCase()}`;
      const entry = counts.get(key) ?? { playerId: w.playerId, name: w.name, teamId: w.teamId, value: 0 };
      entry.value += 1;
      counts.set(key, entry);
    }
    return [...counts.values()];
  };
  const result = {} as Record<CountedAward, Contender<P, T>[]>;
  for (const type of COUNTED_AWARDS) {
    const def: CountedDef = COUNTED_AWARD_DEFS[type];
    if ("weekly" in def) {
      result[type] = top(type, winsBy(def.weekly));
      continue;
    }
    result[type] = top(
      type,
      [...byPlayer].map(([playerId, p]) => {
        const totals = aggregateLines(p.lines);
        return {
          playerId,
          name: null,
          teamId: p.teamId,
          value: statValue(def.stat, totals, { games: p.games }) ?? 0,
        };
      }),
    );
  }
  return result;
}

/** The winners among the contenders: everyone tied for the lead. */
export function countedWinners<C extends { value: number }>(contenders: readonly C[]): C[] {
  return contenders.filter((c) => c.value === contenders[0]?.value);
}
