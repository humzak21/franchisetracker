/** The computed side of a season report: team leaders, and labels for what resolved a need. Pure. */
import { TRANSACTION_LABELS, weekLabel, type TransactionType, type WeekKey } from "../domain";
import type { RawStatKey, StatLine } from "../stats/registry";

/** One leader per stat in the season summary, in this order. */
export const LEADER_STATS = [
  "passYds",
  "rushYds",
  "recYds",
  "tackles",
  "sacks",
  "defInt",
] as const satisfies readonly RawStatKey[];

export type Leader<P> = { stat: (typeof LEADER_STATS)[number]; playerId: P; value: number };

/** The team's leader in each summary stat; stats nobody recorded are left out. */
export function teamLeaders<P>(rows: readonly { playerId: P; totals: StatLine }[]): Leader<P>[] {
  return LEADER_STATS.flatMap((stat) => {
    let best: { playerId: P; value: number } | null = null;
    for (const row of rows) {
      const value = row.totals[stat] ?? 0;
      if (value > 0 && (!best || value > best.value)) best = { playerId: row.playerId, value };
    }
    return best ? [{ stat, ...best }] : [];
  });
}

/** "Trade · W3 · Name, Name" or "Signed · Offseason · Name". */
export function transactionLabel(
  type: TransactionType,
  weekKey: WeekKey | undefined,
  names: string[],
): string {
  return [TRANSACTION_LABELS[type], weekKey ? weekLabel(weekKey) : "Offseason", names.join(", ")]
    .filter(Boolean)
    .join(" · ");
}

/** "Rd 1, #12 · Name". */
export function pickLabel(round: number, overall: number, name: string | undefined): string {
  return [`Rd ${round}, #${overall}`, name].filter(Boolean).join(" · ");
}
