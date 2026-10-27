/**
 * When a move happened in the league year (FEATURES.md 5.10): a phase, plus a week for the
 * in-season phases. Orders the feed and labels each card. Pure.
 */
import {
  TRANSACTION_PHASE_LABELS,
  TRANSACTION_PHASES,
  WEEK_KEYS,
  weekIndex,
  weekLabel,
  weekPhase,
  type TransactionPhase,
  type WeekKey,
} from "../domain";

/** Phases that happen during games and so carry a week. */
const WEEKED_PHASES = ["preseason", "regular", "postseason"] as const;
type WeekedPhase = (typeof WEEKED_PHASES)[number];

export function phaseHasWeeks(phase: TransactionPhase): phase is WeekedPhase {
  return (WEEKED_PHASES as readonly string[]).includes(phase);
}

/** The weeks a phase can pick from, in calendar order; none for the offseason phases. */
export function weeksForPhase(phase: TransactionPhase): WeekKey[] {
  if (!phaseHasWeeks(phase)) return [];
  return WEEK_KEYS.filter((w) => weekPhase(w) === phase);
}

/** The phase a week falls in; the Pro Bowl counts as the postseason. */
export function phaseOfWeek(week: WeekKey): TransactionPhase {
  const phase = weekPhase(week);
  return phase === "allstar" ? "postseason" : phase;
}

/** A stored move's phase: its own, else its week's, else the offseason (older rows have none). */
export function resolvePhase(
  phase: TransactionPhase | undefined,
  weekKey: WeekKey | undefined,
): TransactionPhase {
  return phase ?? (weekKey ? phaseOfWeek(weekKey) : "offseason");
}

/** "Week 7", "Wild Card", "Free agency", "During the draft". */
export function timingLabel(phase: TransactionPhase | undefined, weekKey: WeekKey | undefined): string {
  if (weekKey) return weekLabel(weekKey, "long");
  return TRANSACTION_PHASE_LABELS[resolvePhase(phase, weekKey)];
}

/** Sort key: phase order first, then the week within it. */
export function timingOrder(phase: TransactionPhase | undefined, weekKey: WeekKey | undefined): number {
  const p = TRANSACTION_PHASES.indexOf(resolvePhase(phase, weekKey));
  return p * 100 + (weekKey ? weekIndex(weekKey) + 1 : 0);
}

/** Moves in league-year order; ties keep their incoming order. */
export function sortByTiming<T extends { phase?: TransactionPhase; weekKey?: WeekKey }>(
  moves: readonly T[],
): T[] {
  return [...moves].sort((a, b) => timingOrder(a.phase, a.weekKey) - timingOrder(b.phase, b.weekKey));
}

/** Why a phase and week pair cannot be saved, or null when it can. */
export function timingError(phase: TransactionPhase, weekKey: WeekKey | undefined): string | null {
  if (!phaseHasWeeks(phase)) return weekKey ? "Offseason moves have no week" : null;
  if (!weekKey) return `Pick the ${TRANSACTION_PHASE_LABELS[phase].toLowerCase()} week`;
  return phaseOfWeek(weekKey) === phase ? null : `${weekLabel(weekKey, "long")} is not in the ${phase}`;
}
