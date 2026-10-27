/**
 * Positions and position groups. Position keys follow Madden 26 depth chart
 * naming; `POSITION_ALIASES` folds the spellings Madden screens and older games use.
 */

export const POSITIONS = [
  "QB",
  "HB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "LEDG",
  "REDG",
  "DT",
  "SAM",
  "MLB",
  "WILL",
  "CB",
  "FS",
  "SS",
  "K",
  "P",
  "LS",
] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_GROUPS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "DB", "K", "P", "LS"] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

export const SIDES = ["offense", "defense", "special"] as const;
export type Side = (typeof SIDES)[number];

type PositionInfo = { label: string; group: PositionGroup; side: Side };

export const POSITION_INFO: Record<Position, PositionInfo> = {
  QB: { label: "Quarterback", group: "QB", side: "offense" },
  HB: { label: "Halfback", group: "RB", side: "offense" },
  FB: { label: "Fullback", group: "RB", side: "offense" },
  WR: { label: "Wide Receiver", group: "WR", side: "offense" },
  TE: { label: "Tight End", group: "TE", side: "offense" },
  LT: { label: "Left Tackle", group: "OL", side: "offense" },
  LG: { label: "Left Guard", group: "OL", side: "offense" },
  C: { label: "Center", group: "OL", side: "offense" },
  RG: { label: "Right Guard", group: "OL", side: "offense" },
  RT: { label: "Right Tackle", group: "OL", side: "offense" },
  LEDG: { label: "Left Edge", group: "DL", side: "defense" },
  REDG: { label: "Right Edge", group: "DL", side: "defense" },
  DT: { label: "Defensive Tackle", group: "DL", side: "defense" },
  SAM: { label: "Strong Side Linebacker", group: "LB", side: "defense" },
  MLB: { label: "Middle Linebacker", group: "LB", side: "defense" },
  WILL: { label: "Weak Side Linebacker", group: "LB", side: "defense" },
  CB: { label: "Cornerback", group: "DB", side: "defense" },
  FS: { label: "Free Safety", group: "DB", side: "defense" },
  SS: { label: "Strong Safety", group: "DB", side: "defense" },
  K: { label: "Kicker", group: "K", side: "special" },
  P: { label: "Punter", group: "P", side: "special" },
  LS: { label: "Long Snapper", group: "LS", side: "special" },
};

export const POSITION_GROUP_LABELS: Record<PositionGroup, string> = {
  QB: "Quarterbacks",
  RB: "Running Backs",
  WR: "Wide Receivers",
  TE: "Tight Ends",
  OL: "Offensive Line",
  DL: "Defensive Line",
  LB: "Linebackers",
  DB: "Defensive Backs",
  K: "Kickers",
  P: "Punters",
  LS: "Long Snappers",
};

/** Alternate spellings seen on Madden screens, in older games and in real-roster data. */
export const POSITION_ALIASES: Record<string, Position> = {
  RB: "HB",
  LEDGE: "LEDG",
  REDGE: "REDG",
  LE: "LEDG",
  RE: "REDG",
  EDGE: "LEDG",
  DE: "LEDG",
  LOLB: "SAM",
  ROLB: "WILL",
  OLB: "SAM",
  MIKE: "MLB",
  ILB: "MLB",
  LB: "MLB",
  S: "SS",
  NT: "DT",
  PK: "K",
  // Generic groups real-roster sources (nflverse) list instead of a depth-chart slot.
  T: "LT",
  OT: "LT",
  G: "LG",
  OG: "LG",
  OL: "LG",
  DL: "DT",
  DB: "CB",
  SAF: "SS",
};

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

/** Resolves a raw position string ("LEDGE", "SS/LB", "rb") to a canonical position, or null. */
export function normalizePosition(raw: string): Position | null {
  const first =
    raw
      .trim()
      .toUpperCase()
      .split(/[\s/]+/)[0] ?? "";
  if (isPosition(first)) return first;
  return POSITION_ALIASES[first] ?? null;
}

export function positionGroupOf(position: Position): PositionGroup {
  return POSITION_INFO[position].group;
}

export function sideOf(position: Position): Side {
  return POSITION_INFO[position].side;
}

/**
 * Color families for position badges and roster tables: every position reads apart at a glance,
 * except slots that are the same job on either side (the line, edges, linebackers, safeties).
 */
export const POSITION_COLORS = [
  "qb",
  "hb",
  "fb",
  "wr",
  "te",
  "ol",
  "edge",
  "dt",
  "lb",
  "cb",
  "s",
  "k",
  "p",
  "ls",
] as const;
export type PositionColor = (typeof POSITION_COLORS)[number];

const COLOR_OF: Record<Position, PositionColor> = {
  QB: "qb",
  HB: "hb",
  FB: "fb",
  WR: "wr",
  TE: "te",
  LT: "ol",
  LG: "ol",
  C: "ol",
  RG: "ol",
  RT: "ol",
  LEDG: "edge",
  REDG: "edge",
  DT: "dt",
  SAM: "lb",
  MLB: "lb",
  WILL: "lb",
  CB: "cb",
  FS: "s",
  SS: "s",
  K: "k",
  P: "p",
  LS: "ls",
};

export function positionColor(position: Position): PositionColor {
  return COLOR_OF[position];
}
