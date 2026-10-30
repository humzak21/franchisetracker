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

/**
 * How a player entered the franchise: the NFL history import (or the sample's real players), a
 * draft class, another captured screen, or typed in by hand. Absent until Settings has tidied a
 * player from before this was recorded.
 */
export const PLAYER_ORIGINS = ["import", "draft", "screenshot", "manual"] as const;
export type PlayerOrigin = (typeof PLAYER_ORIGINS)[number];

export const PLAYER_ORIGIN_LABELS: Record<PlayerOrigin, string> = {
  import: "NFL history import",
  draft: "Draft class",
  screenshot: "Captured from a screen",
  manual: "Typed in by hand",
};

export const ROSTER_STATUSES = ["active", "ir", "practice_squad", "released", "traded"] as const;
export type RosterStatus = (typeof ROSTER_STATUSES)[number];

export const ROSTER_STATUS_LABELS: Record<RosterStatus, string> = {
  active: "Active",
  ir: "Injured reserve",
  practice_squad: "Practice squad",
  released: "Released",
  traded: "Traded away",
};

/** Madden hides a rookie's trait until it is revealed in his first season; "hidden" records that. */
export const DEV_TRAITS = ["hidden", "normal", "star", "superstar", "xfactor"] as const;
export type DevTrait = (typeof DEV_TRAITS)[number];

export const DEV_TRAIT_LABELS: Record<DevTrait, string> = {
  hidden: "Hidden",
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

export const TRANSACTION_LABELS: Record<TransactionType, string> = {
  sign: "Signed",
  resign: "Re-signed",
  release: "Released",
  trade: "Trade",
  waiver_claim: "Waiver claim",
  ir: "Placed on IR",
  activate: "Activated",
  extension: "Extension",
  restructure: "Restructure",
  retire: "Retired",
};

/**
 * When in the league year a move happened. Offseason phases come before the season they lead
 * into, in this order; the in-season phases also carry a week key.
 */
export const TRANSACTION_PHASES = [
  "offseason",
  "resign",
  "free_agency",
  "draft",
  "post_draft",
  "preseason",
  "regular",
  "postseason",
] as const;
export type TransactionPhase = (typeof TRANSACTION_PHASES)[number];

export const TRANSACTION_PHASE_LABELS: Record<TransactionPhase, string> = {
  offseason: "Offseason",
  resign: "Re-signing period",
  free_agency: "Free agency",
  draft: "During the draft",
  post_draft: "After the draft",
  preseason: "Preseason",
  regular: "Regular season",
  postseason: "Postseason",
};

export const NEED_PRIORITIES = ["high", "medium", "low"] as const;
export type NeedPriority = (typeof NEED_PRIORITIES)[number];
