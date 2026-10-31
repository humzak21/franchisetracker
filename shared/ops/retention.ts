/** How long finished screenshots are kept. Committed data never goes: only the images and their reads. */

const DAY_MS = 86_400_000;

export const DEFAULT_KEEP_DAYS = 180;
/** A rejected screenshot was never going to be used. */
const REJECTED_KEEP_DAYS = 30;
/** `keepScreenshotsDays` value for never deleting anything. */
export const KEEP_FOREVER = 0;

export const KEEP_OPTIONS = [
  { value: 90, label: "90 days" },
  { value: DEFAULT_KEEP_DAYS, label: "180 days" },
  { value: 365, label: "1 year" },
  { value: KEEP_FOREVER, label: "Forever" },
] as const;

/** Uploads created before these times are due, or null when nothing is ever deleted. */
export function retentionCutoffs(keepDays: number | undefined, now: number) {
  const days = keepDays ?? DEFAULT_KEEP_DAYS;
  if (days === KEEP_FOREVER) return null;
  return {
    committed: now - days * DAY_MS,
    rejected: now - Math.min(days, REJECTED_KEEP_DAYS) * DAY_MS,
  };
}
