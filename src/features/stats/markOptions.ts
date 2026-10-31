import { getStat, MARK_STATS, STAT_CATEGORY_LABELS } from "@shared/stats";

/** The stats marks and spans are kept for, grouped as the registry groups them. */
export const MARK_STAT_OPTIONS = MARK_STATS.map((value) => {
  const { label, category } = getStat(value);
  return { value, label, group: STAT_CATEGORY_LABELS[category] };
}).sort((a, b) => a.group.localeCompare(b.group));
