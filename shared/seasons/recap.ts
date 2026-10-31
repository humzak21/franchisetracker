/** The season recap's own words and lists (FEATURES.md 5.7); the numbers come from other modules. Pure. */
import { AWARD_INFO, AWARD_TYPES, type AwardType } from "../domain/awards";
import { PLAYOFF_RESULT_LABELS, weekIndex, type PlayoffResult, type WeekKey } from "../domain/calendar";
import type { TransactionType } from "../domain/roster";
import type { WLT } from "../games/summary";
import { formatOrdinal, formatRecord } from "../stats/format";

/** "12-5 · 1st in the NFC East · Seed 2 · Lost Divisional". */
export function recapHeadline(input: {
  regular: WLT;
  divisionRank: number | null;
  division: string;
  seed: number | null;
  playoffResult: PlayoffResult | null;
}) {
  const { regular, divisionRank, division, seed, playoffResult } = input;
  return [
    formatRecord(regular),
    divisionRank === null ? null : `${formatOrdinal(divisionRank)} in the ${division}`,
    seed === null ? null : `Seed ${seed}`,
    playoffResult === null ? null : PLAYOFF_RESULT_LABELS[playoffResult],
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

type AwardRow<P> = {
  type: AwardType;
  customName?: string;
  weekKey?: string;
  playerId?: P;
  name: string;
};

export type RecapAward<P> = { key: string; label: string; name: string; playerId?: P; count: number };

/** One line per award and winner: a weekly award won three times is one line. Yearly ones lead. */
export function recapAwards<P>(awards: readonly AwardRow<P>[]): RecapAward<P>[] {
  const lines = new Map<string, RecapAward<P> & { weekly: boolean; type: AwardType }>();
  for (const a of awards) {
    const label = a.type === "custom" ? (a.customName ?? AWARD_INFO.custom.label) : AWARD_INFO[a.type].label;
    const key = `${label}:${a.playerId ?? a.name}`;
    const seen = lines.get(key);
    if (seen) seen.count += 1;
    else {
      const weekly = a.weekKey !== undefined;
      lines.set(key, { key, label, name: a.name, playerId: a.playerId, count: 1, weekly, type: a.type });
    }
  }
  return [...lines.values()]
    .sort(
      (a, b) =>
        Number(a.weekly) - Number(b.weekly) ||
        AWARD_TYPES.indexOf(a.type) - AWARD_TYPES.indexOf(b.type) ||
        b.count - a.count,
    )
    .map(({ weekly: _weekly, type: _type, ...line }) => line);
}

/** The moves a recap tells, biggest kind first. Injuries and paper moves stay on Transactions. */
const TOLD_MOVES: readonly TransactionType[] = [
  "trade",
  "sign",
  "resign",
  "extension",
  "waiver_claim",
  "release",
  "retire",
];
/** Moves a recap lists before pointing to Transactions. */
export const RECAP_MOVES = 12;

export function recapMoves<M extends { type: TransactionType; weekKey?: WeekKey }>(moves: readonly M[]) {
  const when = (m: M) => (m.weekKey ? weekIndex(m.weekKey) : -1);
  const told = moves
    .filter((m) => TOLD_MOVES.includes(m.type))
    .sort((a, b) => TOLD_MOVES.indexOf(a.type) - TOLD_MOVES.indexOf(b.type) || when(a) - when(b));
  return { shown: told.slice(0, RECAP_MOVES), total: told.length };
}
