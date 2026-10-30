/**
 * Row targets: screens that are a list (leaders, standings, a roster page, the draft board).
 * Each is declared as fields, and one schema builder, normalizer, validator, merge and review
 * editor serve them all. Rows are accepted one by one in review; only accepted rows commit.
 */
import type { GameLine } from "../../games/scorers";
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
  /** Someone decided this name is a new player, so an unsettled match can commit. */
  confirmedNew?: boolean;
};

export type RowsDraft<P extends string = string, T extends string = string> = {
  target: T;
  /** Screen-level fields: which stat a leaders board ranks, whose roster a page shows. */
  meta: Record<string, RowValue>;
  rows: DraftRow<P>[];
};

/** The game a game-scoped list is filed under, for the checks that need it. */
export type RowGameContext<P extends string = string> = {
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  /** The game's box score, both teams; empty until one is committed. */
  lines: GameLine<P>[];
};

/** How a row target reads and checks its screen. Pure data plus a few small functions. */
export type RowSpec = {
  /** Rows name a player, resolved against the rosters like box score lines. */
  player: boolean;
  /**
   * A row can stand without a player: the screen may drop a name, and a name it does print never
   * creates a player, since a line like this is too thin to know a new person by.
   */
  optionalPlayer?: boolean;
  /** Rows carry a team (a standings row, a leader's team). */
  rowTeam: boolean;
  /**
   * Rows are players new to the franchise (a draft class, mostly created players): reading matches
   * them only against this season's picks and created players, never the rosters, and review can
   * also find them in college football.
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
  /** The order rows read in, for screens where it means something. */
  order?: (a: Pick<DraftRow, "values">, b: Pick<DraftRow, "values">) => number;
  /** A line the row card shows under the row's name, worked out from its fields. */
  caption?: (row: Pick<DraftRow, "values">) => string | null;
  /**
   * Target-specific consistency checks on accepted rows. A game-scoped target also gets its game:
   * null when there is none, undefined while that is not known yet.
   */
  rules?: (draft: RowsDraft, game?: RowGameContext | null) => DraftWarning[];
};
