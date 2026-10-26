import { STAT_KEYS } from "@shared/stats";

export type Split = "regular" | "postseason";

export const SPLIT_OPTIONS = [
  { value: "regular", label: "Regular season" },
  { value: "postseason", label: "Playoffs" },
] as const satisfies readonly { value: Split; label: string }[];

/** Registry order, so passing yards leads passing and records read like a box score. */
export const byRegistryOrder = <T extends { statKey: string }>(a: T, b: T) =>
  STAT_KEYS.indexOf(a.statKey as (typeof STAT_KEYS)[number]) -
  STAT_KEYS.indexOf(b.statKey as (typeof STAT_KEYS)[number]);
