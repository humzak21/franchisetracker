/** Quarter-by-quarter scoring: column labels and the checks a hand-typed line score has to pass. */

export type LineScore = { home: number[]; away: number[] };

/** Regulation quarters, then one column per overtime period. */
export const REGULATION_QUARTERS = 4;
/** Madden's playoff overtime can run long; more periods than this is a typo. */
const MAX_PERIODS = 8;

/** "1", "2", "3", "4", then "OT", "2OT", ... */
export function periodLabel(index: number): string {
  if (index < REGULATION_QUARTERS) return String(index + 1);
  const ot = index - REGULATION_QUARTERS + 1;
  return ot === 1 ? "OT" : `${ot}OT`;
}

const sum = (points: readonly number[]) => points.reduce((a, b) => a + b, 0);

/** Why a line score can't be saved against the final score, or null when it adds up. */
export function lineScoreError(
  line: LineScore,
  final: { home: number | null; away: number | null },
): string | null {
  if (line.home.length !== line.away.length) return "Both teams need the same number of periods";
  if (line.home.length < REGULATION_QUARTERS) return "Enter all four quarters";
  if (line.home.length > MAX_PERIODS) return `At most ${MAX_PERIODS} periods`;
  if ([...line.home, ...line.away].some((p) => !Number.isInteger(p) || p < 0)) {
    return "Points are whole numbers, zero or more";
  }
  for (const side of ["away", "home"] as const) {
    const score = final[side];
    if (score !== null && sum(line[side]) !== score) {
      return `The ${side} quarters add up to ${sum(line[side])}, not the final ${score}`;
    }
  }
  return null;
}
