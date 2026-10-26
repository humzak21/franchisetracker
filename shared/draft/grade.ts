/**
 * Draft class retrospective (FEATURES.md 5.9): a pick's grade from how the player turned out,
 * against what the slot promised. Shown once two seasons have been played since the draft. Pure.
 */

/** Seasons after the draft before a pick is graded. */
export const GRADE_AFTER_SEASONS = 2;

/** The peak OVR a pick in each round is expected to reach; later rounds share the last. */
const EXPECTED_PEAK = [82, 77, 74, 72, 70, 68, 67] as const;

export type PickOutcome = {
  round: number;
  ovrAtDraft?: number;
  /** OVR on each roster entry since the draft. */
  ovrs: readonly number[];
  /** Regular-season games played for the drafting team. */
  gamesPlayed: number;
  /** Honors since the draft (All-Pro, Pro Bowl, yearly awards). */
  honors: number;
  seasonsSince: number;
};

export type PickGrade = { score: number; letter: "A" | "B" | "C" | "D" | "F" };

const LETTERS: [number, PickGrade["letter"]][] = [
  [85, "A"],
  [70, "B"],
  [55, "C"],
  [40, "D"],
];

/**
 * 0 to 100: half from the peak OVR against the round's expectation, the rest from playing
 * time and honors. Null until enough seasons have been played to judge.
 */
export function gradePick(outcome: PickOutcome): PickGrade | null {
  if (outcome.seasonsSince < GRADE_AFTER_SEASONS) return null;
  const expected = EXPECTED_PEAK[Math.min(Math.max(outcome.round, 1), EXPECTED_PEAK.length) - 1]!;
  const peak = Math.max(outcome.ovrAtDraft ?? 0, ...outcome.ovrs, 0);
  const talent = peak === 0 ? 0 : 50 + (peak - expected) * 3;
  const playing =
    (Math.min(outcome.gamesPlayed, 17 * outcome.seasonsSince) / (17 * outcome.seasonsSince)) * 30;
  const score = Math.round(
    Math.min(100, Math.max(0, talent * 0.6 + playing + Math.min(outcome.honors, 3) * 8)),
  );
  const letter = LETTERS.find(([min]) => score >= min)?.[1] ?? "F";
  return { score, letter };
}

/** A class's grade: the average score of its graded picks. */
export function gradeClass(grades: readonly (PickGrade | null)[]): PickGrade | null {
  const graded = grades.filter((g): g is PickGrade => g !== null);
  if (graded.length === 0) return null;
  const score = Math.round(graded.reduce((n, g) => n + g.score, 0) / graded.length);
  return { score, letter: LETTERS.find(([min]) => score >= min)?.[1] ?? "F" };
}
