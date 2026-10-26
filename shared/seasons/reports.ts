/**
 * Season reports (FEATURES.md 4.1, 5.1, 5.7): which prompt is due, and the offseason needs
 * checklist. Pure; the dashboard, the banner and the report editor all read these.
 */
import type { NeedPriority, SeasonStatus } from "../domain";

export const REPORT_PROMPTS = ["preseason", "postseason"] as const;
export type ReportPrompt = (typeof REPORT_PROMPTS)[number];

export const PROMPT_LABELS: Record<ReportPrompt, { title: string; due: string; question: string }> = {
  preseason: {
    title: "Pre-season report",
    due: "Pre-season report due",
    question: "What do you expect from this team? Goals, worries, the players to watch.",
  },
  postseason: {
    title: "Post-season report",
    due: "Post-season report due",
    question: "How did it go? What worked, what did not, and what the offseason has to fix.",
  },
};

export const NEED_PRIORITY_LABELS: Record<NeedPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** A dismissed banner comes back after this long; the dashboard card never hides. */
export const PROMPT_SNOOZE_MS = 12 * 60 * 60 * 1000;

export type PromptState = { status: "pending" | "answered"; answeredAt?: number; dismissedAt?: number };
export type ReportPrompts = Record<ReportPrompt, PromptState>;

export const NEW_PROMPTS: ReportPrompts = {
  preseason: { status: "pending" },
  postseason: { status: "pending" },
};

type SeasonLike<S extends string> = { _id: S; year: number; status: SeasonStatus };

export type DuePrompt<S extends string> = {
  seasonId: S;
  year: number;
  prompt: ReportPrompt;
  dismissedAt?: number;
};

/** Seasons played in the franchise, oldest first; imported real NFL seasons never get reports. */
export function franchiseSeasons<T extends { year: number }>(seasons: readonly T[], startYear: number): T[] {
  return seasons.filter((s) => s.year >= startYear).sort((a, b) => a.year - b.year);
}

/** The season being played (the first not complete) and the latest finished one. */
export function reportSeasons<S extends string, T extends SeasonLike<S>>(
  seasons: readonly T[],
  startYear: number,
): { current: T | undefined; lastComplete: T | undefined } {
  const own = franchiseSeasons(seasons, startYear);
  const current = own.find((s) => s.status !== "complete");
  const lastComplete = own
    .filter((s) => s.status === "complete" && (!current || s.year < current.year))
    .at(-1);
  return { current, lastComplete };
}

/** The year being played (else the latest franchise season, else the first): a default for new entries. */
export function currentSeasonYear<S extends string>(
  seasons: readonly SeasonLike<S>[],
  startYear: number,
): number {
  const { current } = reportSeasons(seasons, startYear);
  return current?.year ?? franchiseSeasons(seasons, startYear).at(-1)?.year ?? startYear;
}

/**
 * Prompts that are due: the pre-season report of the season being played, and the post-season
 * report of the season that just finished. Both stay due until answered, however often the
 * banner is dismissed. A season without a report row has nothing answered yet.
 */
export function duePrompts<S extends string>(
  seasons: readonly SeasonLike<S>[],
  promptsBySeason: ReadonlyMap<S, ReportPrompts>,
  startYear: number,
): DuePrompt<S>[] {
  const { current, lastComplete } = reportSeasons(seasons, startYear);
  const due: DuePrompt<S>[] = [];
  const add = (season: SeasonLike<S> | undefined, prompt: ReportPrompt) => {
    if (!season) return;
    const state = (promptsBySeason.get(season._id) ?? NEW_PROMPTS)[prompt];
    if (state.status === "answered") return;
    due.push({ seasonId: season._id, year: season.year, prompt, dismissedAt: state.dismissedAt });
  };
  add(lastComplete, "postseason");
  add(current, "preseason");
  return due;
}

/** Whether the banner for this prompt is hidden right now (dismissed less than the snooze ago). */
export function isSnoozed(prompt: { dismissedAt?: number }, now: number): boolean {
  return prompt.dismissedAt !== undefined && now - prompt.dismissedAt < PROMPT_SNOOZE_MS;
}

export type NeedLike = {
  key: string;
  priority: NeedPriority;
  resolvedByTransactionId?: string;
  resolvedByDraftPickId?: string;
  resolvedAt?: number;
};

/** A need is open until a transaction, a draft pick or a note resolves it. */
export function isNeedOpen(need: NeedLike): boolean {
  return !need.resolvedByTransactionId && !need.resolvedByDraftPickId && need.resolvedAt === undefined;
}

const PRIORITY_ORDER: Record<NeedPriority, number> = { high: 0, medium: 1, low: 2 };

/** Open needs first, then by priority; ties keep the order they were written in. */
export function sortNeeds<T extends NeedLike>(needs: readonly T[]): T[] {
  return needs
    .map((need, index) => ({ need, index }))
    .sort(
      (a, b) =>
        Number(!isNeedOpen(a.need)) - Number(!isNeedOpen(b.need)) ||
        PRIORITY_ORDER[a.need.priority] - PRIORITY_ORDER[b.need.priority] ||
        a.index - b.index,
    )
    .map(({ need }) => need);
}

/** A short key for a new need, unique within its report. */
export function needKey(existing: readonly { key: string }[], seed: number): string {
  const taken = new Set(existing.map((n) => n.key));
  let n = seed;
  while (taken.has(`n${n.toString(36)}`)) n++;
  return `n${n.toString(36)}`;
}
