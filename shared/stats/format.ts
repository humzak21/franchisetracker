/** Display formatting for stats, records and ranks. Missing values render as an em dash. */
import { STAT_REGISTRY, type StatFormat, type StatKey } from "./registry";

export const MISSING = "—";

const intFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatValue(value: number | null | undefined, format: StatFormat): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return MISSING;
  switch (format) {
    case "int":
      return intFormatter.format(value);
    case "decimal":
    case "rating":
      return value.toFixed(1);
    case "pct":
      return `${value.toFixed(1)}%`;
    case "half":
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
}

export function formatStat(key: StatKey, value: number | null | undefined): string {
  return formatValue(value, STAT_REGISTRY[key].format);
}

export function formatOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "3rd" or "T-3rd". */
export function formatRank(rank: number, tied = false): string {
  return `${tied ? "T-" : ""}${formatOrdinal(rank)}`;
}

export type Record3 = { w: number; l: number; t?: number };

/** "12-5" or "12-4-1" when there are ties. */
export function formatRecord({ w, l, t = 0 }: Record3): string {
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

/** "+42", "-7", "0". */
export function formatSigned(value: number): string {
  if (value > 0) return `+${intFormatter.format(value)}`;
  return intFormatter.format(value);
}

export function winPct({ w, l, t = 0 }: Record3): number | null {
  const games = w + l + t;
  return games === 0 ? null : (w + t / 2) / games;
}
