/** Pure stat math. Every function returns null instead of NaN or Infinity. */

export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

/** Percentage on a 0 to 100 scale. */
export function pct(made: number, attempts: number): number | null {
  const ratio = safeDiv(made, attempts);
  return ratio === null ? null : ratio * 100;
}

export function perGame(total: number, games: number): number | null {
  return safeDiv(total, games);
}

export const PERFECT_PASSER_RATING = 158.3;

type PasserLine = { cmp: number; att: number; yds: number; td: number; int: number };

/** NFL passer rating. Each component is clamped to [0, 2.375]; result is rounded to one decimal. */
export function passerRating({ cmp, att, yds, td, int }: PasserLine): number | null {
  if (att <= 0) return null;
  const clamp = (value: number) => Math.min(Math.max(value, 0), 2.375);
  const a = clamp((cmp / att - 0.3) * 5);
  const b = clamp((yds / att - 3) * 0.25);
  const c = clamp((td / att) * 20);
  const d = clamp(2.375 - (int / att) * 25);
  return Math.round(((a + b + c + d) / 6) * 1000) / 10;
}

export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
