/** The monthly extraction budget (FEATURES.md 5.11): a warning at 80 percent, a stop at the limit. */

export const BUDGET_WARN_SHARE = 0.8;

/** Screenshots stay queued with this until the month rolls over or the budget goes up. */
export const BUDGET_HELD = "Held: this month's extraction budget is spent.";
export const DUPLICATE_HELD = "Already uploaded. Read it anyway, or delete it.";

export const UPLOAD_HOLDS = ["budget", "duplicate"] as const;
export type UploadHold = (typeof UPLOAD_HOLDS)[number];

/** "2026-10", in UTC so a month never depends on where the phone is. */
export const usageMonth = (now: number) => new Date(now).toISOString().slice(0, 7);

export type BudgetLevel = "none" | "ok" | "warn" | "over";

export function budgetLevel(spentUsd: number, budgetUsd: number | undefined): BudgetLevel {
  if (!budgetUsd) return "none";
  if (spentUsd >= budgetUsd) return "over";
  return spentUsd >= budgetUsd * BUDGET_WARN_SHARE ? "warn" : "ok";
}
