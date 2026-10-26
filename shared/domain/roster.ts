/** Enums for how players arrive, their roster status, transactions and dev traits. */

export const ACQUISITION_TYPES = ["draft", "free_agent", "trade", "waiver", "undrafted", "resign"] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

export const ACQUISITION_LABELS: Record<AcquisitionType, string> = {
  draft: "Drafted",
  free_agent: "Free agent",
  trade: "Trade",
  waiver: "Waiver claim",
  undrafted: "Undrafted FA",
  resign: "Re-signed",
};

export const ROSTER_STATUSES = ["active", "ir", "practice_squad", "released"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export const DEV_TRAITS = ["normal", "star", "superstar", "xfactor"] as const;
export type DevTrait = (typeof DEV_TRAITS)[number];

export const DEV_TRAIT_LABELS: Record<DevTrait, string> = {
  normal: "Normal",
  star: "Star",
  superstar: "Superstar",
  xfactor: "X-Factor",
};

export const TRANSACTION_TYPES = [
  "sign",
  "resign",
  "release",
  "trade",
  "waiver_claim",
  "ir",
  "activate",
  "extension",
  "restructure",
  "retire",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const NEED_PRIORITIES = ["high", "medium", "low"] as const;
export type NeedPriority = (typeof NEED_PRIORITIES)[number];
