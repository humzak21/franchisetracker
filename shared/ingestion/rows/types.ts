/**
 * Row targets: screens that are a list (leaders, standings, a roster page, the draft board).
 * Each is declared as fields, and one schema builder, normalizer, validator, merge and review
 * editor serve them all. Rows are accepted one by one in review; only accepted rows commit.
 */
import type { JsonSchema } from "../schema";
import type { DraftWarning, PlayerMatch } from "../types";

export type RowValue = number | string | boolean | null;

export type FieldType = "int" | "number" | "text" | "enum" | "bool" | "team" | "position";

export type RowField = {
  key: string;
  label: string;
  type: FieldType;
  /** Enum choices: the stored value and what review shows. */
  options?: readonly { value: string; label: string }[];
  /** On the row card without expanding it, and kept in view on a phone. */
  primary?: boolean;
  /** An accepted row without it cannot commit. */
  required?: boolean;
  /** What the model is told the field is; defaults to the label. */
  hint?: string;
};

export type DraftRow<P extends string = string> = {
  /** Stable within a draft, from the row's identity; review edits and confidence paths use it. */
  id: string;
  /** Only accepted rows commit. Rows the model was sure of start accepted. */
  accepted: boolean;
  /** The player's name as printed, for targets whose rows are players. */
  name: string | null;
  teamAbbr: string | null;
  values: Record<string, RowValue>;
  playerId: P | null;
  match: PlayerMatch<P> | null;
};

export type RowsDraft<P extends string = string, T extends string = string> = {
  target: T;
  /** Screen-level fields: which stat a leaders board ranks, whose roster a page shows. */
  meta: Record<string, RowValue>;
  rows: DraftRow<P>[];
};

/** How a row target reads and checks its screen. Pure data plus a few small functions. */
export type RowSpec = {
  /** Rows name a player, resolved against the rosters like box score lines. */
  player: boolean;
  /** Rows carry a team (a standings row, a leader's team). */
  rowTeam: boolean;
  /**
   * Rows are players new to the franchise (a draft class, mostly created players): reading does
   * not match their names to the rosters, and review can also find them in college football.
   */
  newPlayers?: boolean;
  meta: readonly RowField[];
  /** The row's fields for a draft; season stats show only the categories the screen had. */
  fields: (draft?: RowsDraft) => readonly RowField[];
  /** Rows with the same identity from two screenshots are one row (union of rows). */
  identity: (row: Pick<DraftRow, "name" | "teamAbbr" | "values">) => string;
  /** Custom answer properties for the rows, when the screen is not one flat `rows` list. */
  rowsSchema?: () => Record<string, JsonSchema>;
  /** Custom reading of the model's answer into rows, paired with `rowsSchema`. */
  readRows?: (raw: Record<string, unknown>) => Record<string, unknown>[];
  /** A line the row card shows under the row's name, worked out from its fields. */
  caption?: (row: Pick<DraftRow, "values">) => string | null;
  /** Target-specific consistency checks on accepted rows. */
  rules?: (draft: RowsDraft) => DraftWarning[];
};
